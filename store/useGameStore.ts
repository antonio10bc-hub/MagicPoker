import { create } from 'zustand';
import { Card, CombatResult, Difficulty, GamePhase, GameResult, Owner, PlayerState, Screen, SealId } from '@/types';
import {
  applyPreCombatSeals, applyReveal, calculateCombat, clearDefeatedCards, isIdleDraw, isQuietFight, isStalemate, nextIdleTurns, risenPhoenixes, countRankOnBoard, createPlayerState,
  drawCards, drawRound, getGameResult, hideFromRival, lifeGains, markCombatResult, playCardToSlot, RANKS, revealBoard, SealEvent, unhideBoard,
} from '@/lib/game-utils';
import {
  ALL_SEALS, BOSSES, bossLives, createBossState, currentBossIndex, getProgress, recordBossDefeat, recordRematchWin, rematchLevel, unlockedSeals,
} from '@/lib/bosses';
import { chooseOpponentMove } from '@/lib/ai';
import { buildMatchDeck, includeNewSeal } from '@/lib/deck';
import { archetype, buildForestDeck, Encounter, FOREST_LIVES, forestAi, bestiaryComplete, getForest, recordForestDuel } from '@/lib/forest';
import { buildRunDeck, CastleOutcome, castleBossLevel, castleBossLives, ensureRun, recordCastleLoss, recordCastleWin, trackCastleFight } from '@/lib/castle';
import { gameTimeout, setPaused } from '@/lib/clock';
import { playSfx, playSound } from '@/lib/sounds';
import { SEAL_SFX } from '@/lib/synth';
import { incrementStat, recordCardPlayed, recordGameEnd, recordRound, unlockStamp } from '@/lib/stats';
import { endStamps, newMatchTrack, roundStamps, StampId } from '@/lib/stamps';
import { clearGame, loadGame, saveGame } from '@/lib/savegame';
import { useUiStore } from '@/store/useUiStore';
import { track as trackEvent } from '@/lib/analytics';
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
  /** Turnos seguidos en los que nadie ha jugado nada (ver isIdleDraw) */
  idleTurns: number;
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
  /** Duelo del Bosque: quién salió y en qué dificultad */
  forest: Encounter | null;
  /** Presentación del jefe al empezar una partida nueva (id del momento) */
  intro: number | null;
  /** Espía: carta de la mano del rival que acabas de ver */
  spyFx: { id: number; rank: Card['rank'] } | null;
  /** Efectos de sello de antes del choque (cambios de sitio), para animarlos */
  sealFx: { id: number; events: SealEvent[] } | null;
  /** Paso del tutorial guiado (null = partida normal) */
  tutorialStep: number | null;
  /** Cara o cruz al empezar: quién abre la partida (se lanza tras la presentación) */
  coin: { id: number; opener: Owner } | null;
  /** Quién abre la ronda en curso (las rondas se alternan) */
  opener: Owner;

  setDifficulty: (diff: Difficulty) => void;
  /** Entra en el Castillo: la pelea del piso en el que vas (o una subida nueva) */
  startCastle: () => void;
  /** Empieza contra un boss ya alcanzado (por defecto, el actual) */
  startGame: (bossIndex?: number, rematch?: boolean) => void;
  /** El Bosque: su pantalla y un duelo contra quien salga */
  enterForest: () => void;
  startForest: (e: Encounter) => void;
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
  /** Tras el cara o cruz: empieza la primera ronda, la abra quien la abra */
  beginMatch: () => void;
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

/** Jefes del principio contra la IA normal (los demás, la difícil) */
const EASY_BOSSES = 4;

/** Cara (empiezas tú) o cruz (empieza el rival): la partida espera en 'start' a la moneda */
const tossCoin = () => ({ phase: 'start' as GamePhase, coin: { id: Date.now(), opener: (Math.random() < 0.5 ? 'player' : 'opponent') as Owner } });
const other = (o: Owner): Owner => (o === 'player' ? 'opponent' : 'player');
/** Si abre el rival, espera a que pase el cartel de la ronda antes de pensar */
const RIVAL_OPENS_MS = 1300;

const award = (ids: StampId[]) => ids.forEach(id => { if (unlockStamp(id)) useUiStore.getState().pushStamp(id); });

const initialMatchState = () => ({
  phase: 'start' as GamePhase,
  turn: 'player' as Owner,
  coin: null as { id: number; opener: Owner } | null,
  opener: 'player' as Owner,
  roundNumber: 1,
  idleTurns: 0,
  pendingCombatResult: null,
  gameResult: null,
  bossIndex: 0,
  rematch: false,
  rematchLevel: 0,
  castle: null,
  castleOutcome: null,
  forest: null,
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
    // Analíticas: cómo acaba cada partida (y si era la primera victoria contra ese jefe)
    {
      const { bossIndex, rematch, castle, rematchLevel: lvl } = get();
      const firstWin = tutorialStep === null && !castle && !rematch && !get().forest && gameResult === 'win' && bossIndex >= getProgress().defeated;
      trackEvent('match_ended', {
        result: gameResult, mode: tutorialStep !== null ? 'tutorial' : get().forest ? 'forest' : castle ? 'castle' : rematch ? 'rematch' : 'boss',
        forest_rival: get().forest?.id ?? null, forest_tier: get().forest?.tier ?? null,
        boss: BOSSES[bossIndex]?.id, boss_index: bossIndex, level: lvl, floor: castle ? castle.stage + 1 : null,
        rounds: roundNumber, lives_left: nextPlayer.lives, rival_lives_left: nextOpponent.lives, first_win: firstWin,
      });
      if (tutorialStep !== null) trackEvent('tutorial_completed');
      if (firstWin) trackEvent('boss_beaten', { boss: BOSSES[bossIndex]?.id, boss_index: bossIndex, rounds: roundNumber });
    }
    if (tutorialStep !== null) {
      markTutorialDone();
    } else {
      const stats = recordGameEnd(gameResult, difficulty, roundNumber, nextPlayer.lives === STARTING_LIVES);
      // Boss vencido: se desbloquea su sello (o la colección, con el primero)
      const { bossIndex, rematch, castle, forest } = get();
      if (forest) {
        // Bosque: al bestiario (y su racha); sin jefes ni desbloqueos
        const f = recordForestDuel(forest, gameResult);
        // Analíticas: el duelo del bosque, para el win rate por dificultad y por rival
        trackEvent('forest_duel_ended', {
          rival: forest.id, tier: forest.tier, result: gameResult, win: gameResult === 'win' ? 1 : 0,
          rounds: roundNumber, lives_left: nextPlayer.lives, rival_lives_left: nextOpponent.lives, streak: f.streak, duels: f.duels,
        });
        if (gameResult === 'win' && forest.tier === 'nightmare') award(['nightmare']);
        if (bestiaryComplete(f)) award(['bestiary']);
      } else if (castle) {
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
        result: gameResult, finalBoss: !forest && get().bossIndex === BOSSES.length - 1, rematch, sealsInDeck: sealsInDeck(), rounds: roundNumber, livesLeft: nextPlayer.lives, startingLives: STARTING_LIVES,
        streak: stats.currentStreak, totalGames: stats.totalGames, track,
      }));
    }
    set({ pendingCombatResult: null, sealFx: null, gameResult, phase: 'end', player: nextPlayer, opponent: nextOpponent });
  };

  return {
  screen: 'menu',
  // Sin selector: cada partida decide lo fino que juega el rival (ver startGame, startForest)
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
    trackEvent('match_started', { mode: 'castle', boss: boss.id, boss_index: run.stage, floor: run.stage + 1, level, lives: run.lives, deck_size: run.deck.length });
    set({
      ...initialMatchState(),
      screen: 'game',
      ...tossCoin(),
      difficulty: 'hard',
      bossIndex: run.stage,
      rematchLevel: level,
      castle: { stage: run.stage },
      intro: Date.now(),
      player: { ...createPlayerState(playerDeck, STARTING_HAND_SIZE, true, run.lives), maxLives: run.maxLives },
      opponent: createBossState(boss, level, castleBossLives(run), STARTING_HAND_SIZE),
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
    trackEvent('match_started', { mode: rematch ? 'rematch' : 'boss', boss: boss.id, boss_index: bossIndex, level, seals_in_deck: deckSeals });

    set({
      ...initialMatchState(),
      screen: 'game',
      ...tossCoin(),
      // Los primeros jefes piensan pero aprietan menos (la IA normal); del 5.º en
      // adelante, y en las revanchas, la difícil
      difficulty: bossIndex < EASY_BOSSES && !rematch ? 'normal' : 'hard',
      bossIndex,
      rematch,
      rematchLevel: level,
      intro: Date.now(),
      player: createPlayerState(playerDeck, STARTING_HAND_SIZE, true),
      opponent: createBossState(boss, level, bossLives(boss, level), STARTING_HAND_SIZE),
    });
  },

  enterForest: () => {
    cancelScheduled();
    trackEvent('forest_entered', { duels: getForest().duels, streak: getForest().streak });
    set({ ...initialMatchState(), screen: 'forest' });
  },

  startForest: (e) => {
    const a = archetype(e.id);
    if (!a) return;
    cancelScheduled();
    playSound('shuffle', 0.6);
    incrementStat('totalGames');
    track = newMatchTrack();
    const playerDeck = buildMatchDeck();
    deckSeals = countSeals(playerDeck);
    trackEvent('match_started', { mode: 'forest', forest_rival: e.id, forest_tier: e.tier, seals_in_deck: deckSeals });
    set({
      ...initialMatchState(),
      screen: 'game',
      ...tossCoin(),
      // Cuánto aprieta: el rival normal o el difícil
      difficulty: forestAi(e.tier),
      forest: e,
      player: createPlayerState(playerDeck, STARTING_HAND_SIZE, true),
      opponent: createPlayerState(buildForestDeck(a, e.tier), STARTING_HAND_SIZE, false, FOREST_LIVES[e.tier]),
    });
  },

  startTutorial: () => {
    cancelScheduled();
    trackEvent('tutorial_started');
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
      forest: saved.forest ?? null,
      opener: saved.opener ?? 'player',
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

    const placed = playCardToSlot(player, cardId, slotIndex, true, wildSeal);
    if (!placed) return;
    // El rival no sabe qué carta es hasta la pelea (un sello puesto encima sí lo ve)
    const nextPlayer = hideFromRival(placed, player.hand.find(c => c.id === cardId), slotIndex);

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
      // Analíticas: qué cartas y sellos se juegan
      trackEvent('card_played', {
        rank: played.rank, seal: sealPut ?? played.seal ?? null, wild: !!played.wild, bonus: played.bonus ?? 0,
        merchant: !!played.merchant, legendary: !!RANKS[played.rank].legendary,
        mode: get().castle ? 'castle' : get().rematch ? 'rematch' : 'boss', boss: BOSSES[get().bossIndex]?.id,
        round: get().roundNumber, slot: slotIndex,
      });
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
    set({ player: nextPlayer, turn: opponent.isPassed ? 'player' : 'opponent', idleTurns: nextIdleTurns(get().idleTurns, 'play') });
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
    set({ player: { ...player, isPassed: true }, turn: 'opponent', idleTurns: nextIdleTurns(get().idleTurns, 'pass') });

    if (opponent.isPassed) get().resolveCombatPhase();
    else schedule(get().opponentTurnAction, TIMINGS.opponentThink);
  },

  opponentTurnAction: () => {
    const { opponent, player, difficulty, phase, tutorialStep } = get();
    if (phase !== 'placement' || tutorialStep !== null) return;

    // Piensa con lo que hay: sus vidas, las tuyas y si ya te has plantado
    // Tus cartas boca abajo no las ve: las imagina entre las que aún no conoce
    const move = chooseOpponentMove(opponent.hand, opponent.board, player.board, difficulty, Math.random,
      { lives: opponent.lives, playerLives: player.lives, playerPassed: player.isPassed, unseen: [...player.hand, ...player.deck] });
    const nextOpponent = move && playCardToSlot(opponent, move.cardId, move.slotIndex, false);

    // Sin cartas o sin huecos: el rival se planta
    if (!nextOpponent) {
      set({ opponent: { ...opponent, isPassed: true }, idleTurns: nextIdleTurns(get().idleTurns, 'pass') });
      if (player.isPassed) get().resolveCombatPhase();
      else set({ turn: 'player' });
      return;
    }

    playSound('click', 0.4);
    set({ opponent: nextOpponent, idleTurns: nextIdleTurns(get().idleTurns, 'play') });
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
      set({ opponent: { ...opponent, board: revealBoard(opponent.board) }, player: { ...player, board: unhideBoard(player.board) } });
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
        if (get().tutorialStep === null && pre.events.some(e => e.kind === 'swap' && e.initiator === 'player' && pre.player[e.index].card?.rank === 'Q')) award(['heist']);
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

    // Castillo: la pelea cuenta para las estadísticas de la subida
    if (get().castle) trackCastleFight({ dealt: result.opponentDamageTaken, lost: result.playerDamageTaken, destroyed: result.deadByOwner.opponent, cardsLost: result.deadByOwner.player });

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
        trackEvent('sovereign_phase2', { lives_left: nextPlayer.lives, round: roundNumber });
      }
    }

    // Bucle infinito → empate: sin cartas por ningún lado, o 4 turnos (2 de cada uno) sin
    // que nadie juegue nada, con una pelea en la que no pasa nada
    const idle = get().idleTurns;
    const gameResult = getGameResult(nextPlayer, nextOpponent)
      ?? (isStalemate(player, opponent, result) || isIdleDraw(idle, player, opponent, result) ? 'draw' : null);

    if (gameResult) {
      endMatch(gameResult, nextPlayer, nextOpponent);
      return;
    }

    // Las rondas se alternan: abre quien no abrió la anterior (en el tutorial, siempre tú)
    const opener = tutorial ? 'player' : other(get().opener);
    set({
      pendingCombatResult: null,
      phase: 'placement',
      turn: opener,
      opener,
      roundNumber: roundNumber + 1,
      // Si la pelea cambió algo, la partida se mueve: la cuenta de inactividad vuelve a 0
      idleTurns: isQuietFight(player, opponent, result) ? idle : 0,
      player: drawRound(nextPlayer, CARDS_DRAWN_PER_ROUND, true),
      // En el tutorial el rival puede abrir la ronda (Rey y Reina a la vista)
      opponent: tutorial
        ? applyRivalMoves(drawCards(nextOpponent, CARDS_DRAWN_PER_ROUND, false), TUTORIAL_OPENINGS[roundNumber + 1])
        : drawRound(nextOpponent, CARDS_DRAWN_PER_ROUND, false),
    });
    if (opener === 'opponent') schedule(get().opponentTurnAction, RIVAL_OPENS_MS);
  },

  beginMatch: () => {
    const { phase, coin } = get();
    if (phase !== 'start' || !coin) return;
    set({ phase: 'placement', turn: coin.opener, opener: coin.opener, coin: null });
    if (coin.opener === 'opponent') schedule(get().opponentTurnAction, RIVAL_OPENS_MS);
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
      saveGame({ difficulty: state.difficulty, roundNumber: state.roundNumber, bossIndex: state.bossIndex, rematch: state.rematch, rematchLevel: state.rematchLevel, castle: !!state.castle, phase2: !!state.castle?.phase2, forest: state.forest ?? undefined, opener: state.opener, player: state.player, opponent: state.opponent });
    }
    if ((state.phase === 'end' && prev.phase !== 'end') || (state.screen === 'menu' && prev.screen === 'game')) clearGame();
  });
}
