import { create } from 'zustand';
import { Card, CombatResult, Difficulty, GamePhase, GameResult, Owner, PlayerState, Screen, SealId } from '@/types';
import {
  applyPreCombatSeals, applyReveal, calculateCombat, clearDefeatedCards, risenPhoenixes, countRankOnBoard, createPlayerState,
  drawCards, getGameResult, lifeGains, markCombatResult, playCardToSlot, revealBoard, SealEvent,
} from '@/lib/game-utils';
import {
  ALL_SEALS, BOSSES, bossLives, buildBossDeck, currentBossIndex, getProgress, recordBossDefeat, recordRematchWin, rematchLevel, unlockedSeals,
} from '@/lib/bosses';
import { chooseOpponentMove } from '@/lib/ai';
import { buildMatchDeck, includeNewSeal } from '@/lib/deck';
import { buildRunDeck, CastleOutcome, castleBossLevel, castleBossLives, ensureRun, recordCastleLoss, recordCastleWin } from '@/lib/castle';
import { gameTimeout, setPaused } from '@/lib/clock';
import { playSfx, playSound } from '@/lib/sounds';
import { SEAL_SFX } from '@/lib/synth';
import { incrementStat, recordCardPlayed, recordGameEnd, recordRound, unlockStamp } from '@/lib/stats';
import { endStamps, newMatchTrack, roundStamps, StampId } from '@/lib/stamps';
import { clearGame, loadGame, saveGame } from '@/lib/savegame';
import { useUiStore } from '@/store/useUiStore';
import { applyRivalMoves, markTutorialDone, stepCard, TUTORIAL_OPENINGS, TUTORIAL_STEPS, tutorialPlayers, tutorialRng } from '@/lib/tutorial';
import { CARDS_DRAWN_PER_ROUND, JOKER_DRAW_BONUS, STARTING_HAND_SIZE, STARTING_LIVES, TIMINGS } from '@/lib/constants';

interface GameState {
  screen: Screen;
  difficulty: Difficulty;
  phase: GamePhase;
  turn: Owner;
  player: PlayerState;
  opponent: PlayerState;
  roundNumber: number;
  /** Resultado del combate en curso (se muestra durante 'combat-reveal') */
  pendingCombatResult: CombatResult | null;
  gameResult: GameResult | null;
  /** Boss contra el que se juega esta partida (índice en BOSSES) */
  bossIndex: number;
  /** Revancha: el boss (ya vencido) vuelve con una vida más y un segundo sello */
  rematch: boolean;
  /** Nivel de la revancha (1 a 4; 0 si no lo es): cuanto más alto, más fuerte el jefe */
  rematchLevel: number;
  /** Pelea del Castillo en curso (piso = índice del jefe). `phase2`: el Soberano ya se transformó */
  castle: { stage: number; phase2?: boolean } | null;
  /** Fase 2 del Soberano: momento en que se transforma (para su cinemática) */
  phase2Fx: { id: number; from: number; to: number } | null;
  /** Cómo acabó la última pelea del Castillo (para la pantalla final) */
  castleOutcome: CastleOutcome | null;
  /** Presentación del jefe al empezar una partida nueva (id del momento) */
  intro: number | null;
  /** Espía: carta de la mano del rival que acabas de ver */
  spyFx: { id: number; rank: Card['rank'] } | null;
  /** Efectos de sello de antes del choque (cambios de sitio), para animarlos */
  sealFx: { id: number; events: SealEvent[] } | null;
  /** Paso del tutorial guiado (null = partida normal) */
  tutorialStep: number | null;

  setDifficulty: (diff: Difficulty) => void;
  /** Entra en el Castillo: la pelea del piso en el que vas (o una subida nueva) */
  startCastle: () => void;
  /** Empieza contra un boss ya alcanzado (por defecto, el actual) */
  startGame: (bossIndex?: number, rematch?: boolean) => void;
  /** Retoma la partida guardada (si la hay) */
  resumeGame: () => boolean;
  /** Partida guionizada que enseña a jugar */
  startTutorial: () => void;

  exitToMenu: () => void;
  /** Juega una carta en un hueco (el comodín de sello necesita saber qué sello es) */
  placeCard: (cardId: string, slotIndex: number, wildSeal?: SealId) => void;
  passTurn: () => void;
  opponentTurnAction: () => void;
  resolveCombatPhase: () => void;
  finishCombatPhase: () => void;
  drawCard: (target: Owner, amount?: number) => void;
  /** Truco de pruebas: gana la partida en curso */
  debugWin: () => void;
}

// --- TEMPORIZADORES ---
// Todos los retardos de la partida pasan por aquí para poder cancelarlos al
// reiniciar o salir; si no, un turno del rival pendiente "se cuela" en la siguiente
// partida. Van con el reloj de la partida (pausa y velocidad x2).
let pendingTimers = new Set<() => void>();

const schedule = (fn: () => void, ms: number) => {
  const cancel = gameTimeout(() => {
    pendingTimers.delete(cancel);
    fn();
  }, ms);
  pendingTimers.add(cancel);
};

const cancelScheduled = () => {
  pendingTimers.forEach(cancel => cancel());
  pendingTimers = new Set();
};

// --- SEGUIMIENTO DE LA PARTIDA (para logros) ---
let track = newMatchTrack();
/** Cartas de sello en tu mazo al empezar la partida */
let deckSeals = 0;
const sealsInDeck = () => deckSeals;
const countSeals = (cards: Card[]) => cards.filter(c => c.rank === 'SEAL').length;

/** Concede un sello y, si es nuevo, lo pone en la cola para celebrarlo */
/**
 * Sello de revelar recién puesto en `slot`: expone una carta del rival. Devuelve el
 * estado rival nuevo y el efecto que animar (o nada si no aplica).
 */
const revealFor = (played: Card | undefined, slot: number, enemy: PlayerState, enemyOwner: Owner) => {
  if (played?.seal !== 'reveal') return null;
  const r = applyReveal(enemy.board, slot);
  if (!r) return null;
  return { enemy: { ...enemy, board: r.board }, fx: { id: Date.now(), events: [{ kind: 'reveal' as const, owner: enemyOwner, index: r.index }] } };
};

const award = (ids: StampId[]) => ids.forEach(id => { if (unlockStamp(id)) useUiStore.getState().pushStamp(id); });

const initialMatchState = () => ({
  phase: 'start' as GamePhase,
  turn: 'player' as Owner,
  roundNumber: 1,
  pendingCombatResult: null,
  gameResult: null,
  bossIndex: 0,
  rematch: false,
  rematchLevel: 0,
  castle: null,
  castleOutcome: null,
  phase2Fx: null,
  intro: null,
  sealFx: null,
  spyFx: null,
  tutorialStep: null,
  player: createPlayerState(),
  opponent: createPlayerState(),
});

const END_SOUNDS: Record<GameResult, [Parameters<typeof playSound>[0], number]> = {
  win: ['victory', 0.8],
  loss: ['defeat', 0.8],
  draw: ['click', 0.5],
};

export const useGameStore = create<GameState>((set, get) => {
  /** Cierra la partida: estadísticas, boss vencido, logros y pantalla final */
  const endMatch = (gameResult: GameResult, nextPlayer: PlayerState, nextOpponent: PlayerState) => {
    const { difficulty, roundNumber, tutorialStep } = get();
    playSound(...END_SOUNDS[gameResult]);
    if (tutorialStep !== null) {
      markTutorialDone();
    } else {
      const stats = recordGameEnd(gameResult, difficulty, roundNumber, nextPlayer.lives === STARTING_LIVES);
      // Boss vencido: se desbloquea su sello (o la colección, con el primero)
      const { bossIndex, rematch, castle } = get();
      if (castle) {
        // Castillo: subes un piso (y eliges mejora) o se acaba la subida
        const outcome = gameResult === 'win' ? recordCastleWin(nextPlayer.lives) : recordCastleLoss();
        if (outcome.kind === 'conquered') award(['castle']);
        set({ castleOutcome: outcome });
      } else if (gameResult === 'win') {
        if (rematch) recordRematchWin(bossIndex).forEach(u => useUiStore.getState().pushUnlock(u));
        else recordBossDefeat(bossIndex).forEach(u => {
          useUiStore.getState().pushUnlock(u);
          if (u.kind === 'seal') includeNewSeal(u.seal);
        });
        // Todos los sellos desbloqueados
        if (unlockedSeals().length === ALL_SEALS.length) award(['collector']);
      }
      award(endStamps({
        result: gameResult, finalBoss: get().bossIndex === BOSSES.length - 1, rematch, sealsInDeck: sealsInDeck(), rounds: roundNumber, livesLeft: nextPlayer.lives, startingLives: STARTING_LIVES,
        streak: stats.currentStreak, totalGames: stats.totalGames, track,
      }));
    }
    set({ pendingCombatResult: null, sealFx: null, gameResult, phase: 'end', player: nextPlayer, opponent: nextOpponent });
  };

  return {
  screen: 'menu',
  // Sin selector: siempre se juega contra el rival difícil
  difficulty: 'hard',
  ...initialMatchState(),

  setDifficulty: (difficulty) => set({ difficulty }),

  startCastle: () => {
    cancelScheduled();
    playSound('shuffle', 0.6);
    incrementStat('totalGames');
    track = newMatchTrack();
    const run = ensureRun();
    const boss = BOSSES[run.stage];
    const level = castleBossLevel(run.stage, run);
    const playerDeck = buildRunDeck(run);
    deckSeals = countSeals(playerDeck);
    set({
      ...initialMatchState(),
      screen: 'game',
      phase: 'placement',
      bossIndex: run.stage,
      rematchLevel: level,
      castle: { stage: run.stage },
      intro: Date.now(),
      player: { ...createPlayerState(playerDeck, STARTING_HAND_SIZE, true, run.lives), maxLives: run.maxLives },
      opponent: createPlayerState(buildBossDeck(boss, level), STARTING_HAND_SIZE, false, castleBossLives(run)),
    });
  },

  startGame: (pick, wantRematch = false) => {
    cancelScheduled();
    playSound('shuffle', 0.6);
    incrementStat('totalGames');
    track = newMatchTrack();
    // Contra el boss elegido (solo los ya vencidos o el actual): su mazo lleva su
    // sello; el tuyo, los que tengas. Repetir uno vencido no da premio.
    const current = currentBossIndex();
    const bossIndex = pick !== undefined && pick >= 0 && pick <= current ? pick : current;
    const boss = BOSSES[bossIndex];
    // Solo hay revancha contra un boss ya vencido
    const rematch = wantRematch && bossIndex < getProgress().defeated;
    const level = rematch ? rematchLevel(bossIndex) : 0;
    const playerDeck = buildMatchDeck();
    deckSeals = countSeals(playerDeck);

    set({
      ...initialMatchState(),
      screen: 'game',
      phase: 'placement',
      bossIndex,
      rematch,
      rematchLevel: level,
      intro: Date.now(),
      player: createPlayerState(playerDeck, STARTING_HAND_SIZE, true),
      opponent: createPlayerState(buildBossDeck(boss, level), STARTING_HAND_SIZE, false, bossLives(boss, level)),
    });
  },

  startTutorial: () => {
    cancelScheduled();
    playSound('shuffle', 0.6);
    set({ ...initialMatchState(), screen: 'game', phase: 'placement', tutorialStep: 0, ...tutorialPlayers() });
  },

  resumeGame: () => {
    const saved = loadGame();
    if (!saved) return false;
    cancelScheduled();
    track = newMatchTrack();
    deckSeals = countSeals([...saved.player.hand, ...saved.player.deck]);
    playSound('shuffle', 0.5);
    set({
      ...initialMatchState(),
      screen: 'game',
      phase: 'placement',
      turn: 'player',
      difficulty: saved.difficulty,
      roundNumber: saved.roundNumber,
      bossIndex: saved.bossIndex ?? currentBossIndex(),
      rematch: !!saved.rematch,
      rematchLevel: saved.rematchLevel ?? (saved.rematch ? 1 : 0),
      castle: saved.castle ? { stage: saved.bossIndex ?? 0, phase2: !!saved.phase2 } : null,
      player: saved.player,
      opponent: saved.opponent,
    });
    return true;
  },

  exitToMenu: () => {
    cancelScheduled();
    set({ ...initialMatchState(), screen: 'menu' });
  },

  drawCard: (target, amount = 1) => {
    set(state => ({ [target]: drawCards(state[target], amount, target === 'player') }));
  },

  placeCard: (cardId, slotIndex, wildSeal) => {
    const { player, opponent, turn, phase, tutorialStep } = get();
    if (phase !== 'placement' || turn !== 'player' || player.isPassed) return;

    // Tutorial: solo vale la carta y el hueco que pide el paso
    const step = tutorialStep !== null ? TUTORIAL_STEPS[tutorialStep] : undefined;
    if (tutorialStep !== null && (step?.kind !== 'play' || step.slot !== slotIndex || stepCard(player.hand, step)?.id !== cardId)) return;

    const nextPlayer = playCardToSlot(player, cardId, slotIndex, true, wildSeal);
    if (!nextPlayer) return;

    if (step?.kind === 'play') {
      playSound('click', 0.5);
      // El rival responde lo que diga el guion (o nada)
      if (step.rival?.length) {
        set({ player: nextPlayer, turn: 'opponent', tutorialStep: tutorialStep! + 1 });
        schedule(() => {
          playSound('click', 0.4);
          set({ opponent: applyRivalMoves(get().opponent, step.rival), turn: 'player' });
        }, TIMINGS.opponentThink);
      } else {
        set({ player: nextPlayer, tutorialStep: tutorialStep! + 1 });
      }
      return;
    }

    playSound('click', 0.5);
    const played = player.hand.find(c => c.id === cardId);
    // Cada sello suena a lo suyo al ponerlo
    const sealPut = played?.rank === 'SEAL' ? (played.wild ? wildSeal : played.seal) : undefined;
    if (sealPut) playSfx(SEAL_SFX[sealPut]);
    if (played) {
      recordCardPlayed(played.rank);
      track.ranksPlayed.push(played.rank);
      if (played.rank === 'SEAL') track.sealsPlayed++;
    }

    const reveal = revealFor(played, slotIndex, opponent, 'opponent');
    if (reveal) set({ opponent: reveal.enemy, sealFx: reveal.fx });
    // Espía: ves una carta de la mano del rival (al azar)
    if (played?.rank === 'SPY' && opponent.hand.length > 0) {
      set({ spyFx: { id: Date.now(), rank: opponent.hand[Math.floor(Math.random() * opponent.hand.length)].rank } });
    }
    // Si el rival ya se plantó, sigues jugando tú
    set({ player: nextPlayer, turn: opponent.isPassed ? 'player' : 'opponent' });
    if (!opponent.isPassed) schedule(get().opponentTurnAction, TIMINGS.opponentThink);
  },

  passTurn: () => {
    const { phase, turn, player, opponent, tutorialStep } = get();
    if (phase !== 'placement' || turn !== 'player' || player.isPassed) return;

    if (tutorialStep !== null) {
      const step = TUTORIAL_STEPS[tutorialStep];
      if (step?.kind !== 'stand') return;
      playSound('click');
      set({ player: { ...player, isPassed: true }, turn: 'opponent', tutorialStep: tutorialStep + 1 });
      // El rival juega lo que le quede en el guion y empieza la pelea
      schedule(() => {
        if (step.rival?.length) playSound('click', 0.4);
        set({ opponent: { ...applyRivalMoves(get().opponent, step.rival), isPassed: true } });
        schedule(get().resolveCombatPhase, step.rival?.length ? TIMINGS.opponentAfterPlay : 0);
      }, step.rival?.length ? TIMINGS.opponentThink : 200);
      return;
    }

    playSound('click');
    set({ player: { ...player, isPassed: true }, turn: 'opponent' });

    if (opponent.isPassed) get().resolveCombatPhase();
    else schedule(get().opponentTurnAction, TIMINGS.opponentThink);
  },

  opponentTurnAction: () => {
    const { opponent, player, difficulty, phase, tutorialStep } = get();
    if (phase !== 'placement' || tutorialStep !== null) return;

    const move = chooseOpponentMove(opponent.hand, opponent.board, player.board, difficulty);
    const nextOpponent = move && playCardToSlot(opponent, move.cardId, move.slotIndex, false);

    // Sin cartas o sin huecos: el rival se planta
    if (!nextOpponent) {
      set({ opponent: { ...opponent, isPassed: true } });
      if (player.isPassed) get().resolveCombatPhase();
      else set({ turn: 'player' });
      return;
    }

    playSound('click', 0.4);
    set({ opponent: nextOpponent });
    const rivalSeal = opponent.hand.find(c => c.id === move!.cardId)?.seal;
    if (rivalSeal && opponent.hand.find(c => c.id === move!.cardId)?.rank === 'SEAL') playSfx(SEAL_SFX[rivalSeal]);
    const reveal = revealFor(opponent.hand.find(c => c.id === move!.cardId), move!.slotIndex, player, 'player');
    if (reveal) set({ player: reveal.enemy, sealFx: reveal.fx });

    schedule(() => {
      // Si te has plantado, el rival sigue colocando hasta que no pueda más
      if (get().player.isPassed) schedule(get().opponentTurnAction, TIMINGS.opponentThink);
      else set({ turn: 'player' });
    }, TIMINGS.opponentAfterPlay);
  },

  resolveCombatPhase: () => {
    if (get().phase !== 'placement') return;
    set({ phase: 'combat' });

    // 1. Se revelan las cartas del rival y los Jokers dan cartas extra
    schedule(() => {
      const { player, opponent } = get();
      set({ opponent: { ...opponent, board: revealBoard(opponent.board) } });
      get().drawCard('player', countRankOnBoard(player.board, 'JOKER') * JOKER_DRAW_BONUS);
      get().drawCard('opponent', countRankOnBoard(opponent.board, 'JOKER') * JOKER_DRAW_BONUS);

      // 2. Sellos de antes del choque: cambios de sitio y de bando
      const pre = applyPreCombatSeals(get().player.board, get().opponent.board);
      if (pre.events.length > 0) {
        set(s => ({
          player: { ...s.player, board: pre.player },
          opponent: { ...s.opponent, board: pre.opponent },
          sealFx: { id: Date.now(), events: pre.events },
        }));
        // Logro: robar un As con el sello de robo
        if (get().tutorialStep === null && pre.events.some(e => e.kind === 'swap' && e.initiator === 'player' && pre.player[e.index].card?.rank === 'A')) award(['heist']);
      }

      // 3. Se calcula el choque y se marcan las cartas afectadas
      schedule(() => {
        const { player, opponent, tutorialStep, roundNumber } = get();
        const tutorial = tutorialStep !== null;
        const result = calculateCombat(player.board, opponent.board, tutorial ? tutorialRng(player.board, roundNumber) : undefined);

        if (!tutorial) {
          recordRound(result.cardsDestroyedCount, result.opponentDamageTaken, result.playerDamageTaken);
          const mine = new Set(player.board.flatMap(s => (s.card ? [s.card.id] : [])));
          const cards = new Map([...player.board, ...opponent.board].flatMap(s => (s.card ? [[s.card.id, s.card] as const] : [])));
          award(roundStamps(result, mine, cards));
        }
        if (result.voidedCardIds.length > 0) playSound('as_reveal', 0.8);

        set({
          pendingCombatResult: result,
          player: { ...player, board: markCombatResult(player.board, result) },
          opponent: { ...opponent, board: markCombatResult(opponent.board, result) },
        });

        // 4. Se muestra el resultado y el botón de continuar
        schedule(() => set({ phase: 'combat-reveal' }), TIMINGS.combatReveal);
      }, TIMINGS.combatResolve + (pre.events.length > 0 ? TIMINGS.sealMove : 0));
    }, TIMINGS.combatFlip);
  },

  debugWin: () => {
    const { phase, screen, player, opponent } = get();
    if (screen !== 'game' || phase === 'end' || phase === 'start') return;
    cancelScheduled();
    endMatch('win', { ...player, isPassed: false }, { ...opponent, lives: 0, isPassed: false });
  },

  finishCombatPhase: () => {
    const { phase, pendingCombatResult: result, player, opponent, roundNumber, tutorialStep } = get();
    if (phase !== 'combat-reveal') return;
    const tutorial = tutorialStep !== null;
    // En el tutorial, "Continuar" cierra el repaso de la pelea
    if (tutorial && TUTORIAL_STEPS[tutorialStep]?.kind === 'review') set({ tutorialStep: tutorialStep + 1 });

    playSound('click');

    if (!result) {
      set({ phase: 'placement' });
      return;
    }

    // Sello de vida: cada carta con él que muere devuelve una vida (sin pasar del máximo)
    const heal = (s: PlayerState, damage: number) =>
      Math.max(0, Math.min(s.maxLives ?? STARTING_LIVES, s.lives - damage + lifeGains(s.board, result)));
    // El Fénix que cae vuelve a la mano
    const nextPlayer: PlayerState = {
      ...player,
      lives: heal(player, result.playerDamageTaken),
      board: clearDefeatedCards(player.board),
      hand: [...player.hand, ...risenPhoenixes(player.board)],
      isPassed: false,
    };
    const nextOpponent: PlayerState = {
      ...opponent,
      lives: heal(opponent, result.opponentDamageTaken),
      board: clearDefeatedCards(opponent.board),
      hand: [...opponent.hand, ...risenPhoenixes(opponent.board)],
      isPassed: false,
    };

    // Castillo, el Soberano: al bajar a la mitad de vidas (o menos) se transforma una vez
    // y se cura entero
    const { castle, bossIndex } = get();
    // (la cinemática enseña primero la bajada y luego cómo se rellenan: from → to)
    if (castle && !castle.phase2 && BOSSES[bossIndex]?.id === 'sovereign') {
      const max = nextOpponent.maxLives ?? opponent.lives;
      if (nextOpponent.lives <= Math.floor(max / 2)) {
        const from = nextOpponent.lives;
        nextOpponent.lives = max;
        set({ castle: { ...castle, phase2: true }, phase2Fx: { id: Date.now(), from, to: max } });
      }
    }

    const gameResult = getGameResult(nextPlayer, nextOpponent);

    if (gameResult) {
      endMatch(gameResult, nextPlayer, nextOpponent);
      return;
    }

    set({
      pendingCombatResult: null,
      phase: 'placement',
      turn: 'player',
      roundNumber: roundNumber + 1,
      player: drawCards(nextPlayer, CARDS_DRAWN_PER_ROUND, true),
      // En el tutorial el rival puede abrir la ronda (Rey y Reina a la vista)
      opponent: tutorial
        ? applyRivalMoves(drawCards(nextOpponent, CARDS_DRAWN_PER_ROUND, false), TUTORIAL_OPENINGS[roundNumber + 1])
        : drawCards(nextOpponent, CARDS_DRAWN_PER_ROUND, false),
    });
  },
};
});

// Tests visuales (Playwright): en desarrollo el estado se puede leer desde la página
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as { __game: typeof useGameStore }).__game = useGameStore;
}

// --- PAUSA ---
// Con cualquier ventana abierta durante la partida (pausa, reglas, ajustes…) el
// reloj de la partida se detiene
if (typeof window !== 'undefined') {
  useUiStore.subscribe((ui, prev) => {
    if (!!ui.modal !== !!prev.modal) setPaused(!!ui.modal && useGameStore.getState().screen === 'game');
  });
  useGameStore.subscribe((state, prev) => {
    if (state.screen !== prev.screen) setPaused(false);
    // Una ventana nunca sobrevive a un cambio de pantalla ni al final de la partida
    const ended = state.phase === 'end' && prev.phase !== 'end';
    if ((state.screen !== prev.screen || ended) && useUiStore.getState().modal) useUiStore.getState().closeModal();
  });
}

// --- GUARDADO AUTOMÁTICO ---
// En tu turno de colocar el estado es estable: se guarda. Al terminar la partida o
// volver al menú desde una partida, se borra.
if (typeof window !== 'undefined') {
  useGameStore.subscribe((state, prev) => {
    if (state.screen === 'game' && state.phase === 'placement' && state.turn === 'player' && state.tutorialStep === null
      && (state.player !== prev.player || state.opponent !== prev.opponent || state.turn !== prev.turn)) {
      saveGame({ difficulty: state.difficulty, roundNumber: state.roundNumber, bossIndex: state.bossIndex, rematch: state.rematch, rematchLevel: state.rematchLevel, castle: !!state.castle, phase2: !!state.castle?.phase2, player: state.player, opponent: state.opponent });
    }
    if ((state.phase === 'end' && prev.phase !== 'end') || (state.screen === 'menu' && prev.screen === 'game')) clearGame();
  });
}
