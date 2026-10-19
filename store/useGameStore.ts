import { create } from 'zustand';
import { CombatResult, Difficulty, GamePhase, GameResult, Owner, PlayerState, Screen } from '@/types';
import {
  calculateCombat, clearDefeatedCards, countRankOnBoard, createDeck, createPlayerState,
  drawCards, getGameResult, markCombatResult, playCardToSlot, revealBoard,
} from '@/lib/game-utils';
import { chooseOpponentMove } from '@/lib/ai';
import { playSound } from '@/lib/sounds';
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
  /** Paso del tutorial guiado (null = partida normal) */
  tutorialStep: number | null;

  setDifficulty: (diff: Difficulty) => void;
  startGame: () => void;
  /** Retoma la partida guardada (si la hay) */
  resumeGame: () => boolean;
  /** Partida guionizada que enseña a jugar */
  startTutorial: () => void;

  exitToMenu: () => void;
  placeCard: (cardId: string, slotIndex: number) => void;
  passTurn: () => void;
  opponentTurnAction: () => void;
  resolveCombatPhase: () => void;
  finishCombatPhase: () => void;
  drawCard: (target: Owner, amount?: number) => void;
}

// --- TEMPORIZADORES ---
// Todos los retardos de la partida pasan por aquí para poder cancelarlos al
// reiniciar o salir; si no, un turno del rival pendiente "se cuela" en la siguiente partida.
let pendingTimers = new Set<ReturnType<typeof setTimeout>>();

const schedule = (fn: () => void, ms: number) => {
  const id = setTimeout(() => {
    pendingTimers.delete(id);
    fn();
  }, ms);
  pendingTimers.add(id);
};

const cancelScheduled = () => {
  pendingTimers.forEach(clearTimeout);
  pendingTimers = new Set();
};

// --- SEGUIMIENTO DE LA PARTIDA (para sellos) ---
let track = newMatchTrack();

/** Concede un sello y, si es nuevo, lo pone en la cola para celebrarlo */
const award = (ids: StampId[]) => ids.forEach(id => { if (unlockStamp(id)) useUiStore.getState().pushStamp(id); });

const initialMatchState = () => ({
  phase: 'start' as GamePhase,
  turn: 'player' as Owner,
  roundNumber: 1,
  pendingCombatResult: null,
  gameResult: null,
  tutorialStep: null,
  player: createPlayerState(),
  opponent: createPlayerState(),
});

const END_SOUNDS: Record<GameResult, [Parameters<typeof playSound>[0], number]> = {
  win: ['victory', 0.8],
  loss: ['defeat', 0.8],
  draw: ['click', 0.5],
};

export const useGameStore = create<GameState>((set, get) => ({
  screen: 'menu',
  difficulty: 'normal',
  ...initialMatchState(),

  setDifficulty: (difficulty) => set({ difficulty }),

  startGame: () => {
    cancelScheduled();
    playSound('shuffle', 0.6);
    incrementStat('totalGames');
    track = newMatchTrack();

    set({
      ...initialMatchState(),
      screen: 'game',
      phase: 'placement',
      player: createPlayerState(createDeck('player'), STARTING_HAND_SIZE, true),
      opponent: createPlayerState(createDeck('opponent'), STARTING_HAND_SIZE, false),
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
    playSound('shuffle', 0.5);
    set({
      ...initialMatchState(),
      screen: 'game',
      phase: 'placement',
      turn: 'player',
      difficulty: saved.difficulty,
      roundNumber: saved.roundNumber,
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

  placeCard: (cardId, slotIndex) => {
    const { player, opponent, turn, phase, tutorialStep } = get();
    if (phase !== 'placement' || turn !== 'player' || player.isPassed) return;

    // Tutorial: solo vale la carta y el hueco que pide el paso
    const step = tutorialStep !== null ? TUTORIAL_STEPS[tutorialStep] : undefined;
    if (tutorialStep !== null && (step?.kind !== 'play' || step.slot !== slotIndex || stepCard(player.hand, step)?.id !== cardId)) return;

    const nextPlayer = playCardToSlot(player, cardId, slotIndex, true);
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
    if (played) {
      recordCardPlayed(played.rank);
      track.ranksPlayed.push(played.rank);
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

      // 2. Se calcula el choque y se marcan las cartas afectadas
      schedule(() => {
        const { player, opponent, tutorialStep, roundNumber } = get();
        const tutorial = tutorialStep !== null;
        const result = calculateCombat(player.board, opponent.board, tutorial ? tutorialRng(player.board, roundNumber) : undefined);

        if (!tutorial) {
          recordRound(result.cardsDestroyedCount, result.opponentDamageTaken, result.playerDamageTaken);
          award(roundStamps(result));
        }
        if (result.voidedCardIds.length > 0) playSound('as_reveal', 0.8);

        set({
          pendingCombatResult: result,
          player: { ...player, board: markCombatResult(player.board, result) },
          opponent: { ...opponent, board: markCombatResult(opponent.board, result) },
        });

        // 3. Se muestra el resultado y el botón de continuar
        schedule(() => set({ phase: 'combat-reveal' }), TIMINGS.combatReveal);
      }, TIMINGS.combatResolve);
    }, TIMINGS.combatFlip);
  },

  finishCombatPhase: () => {
    const { phase, pendingCombatResult: result, player, opponent, difficulty, roundNumber, tutorialStep } = get();
    if (phase !== 'combat-reveal') return;
    const tutorial = tutorialStep !== null;
    // En el tutorial, "Continuar" cierra el repaso de la pelea
    if (tutorial && TUTORIAL_STEPS[tutorialStep]?.kind === 'review') set({ tutorialStep: tutorialStep + 1 });

    playSound('click');

    if (!result) {
      set({ phase: 'placement' });
      return;
    }

    const nextPlayer: PlayerState = {
      ...player,
      lives: Math.max(0, player.lives - result.playerDamageTaken),
      board: clearDefeatedCards(player.board),
      isPassed: false,
    };
    const nextOpponent: PlayerState = {
      ...opponent,
      lives: Math.max(0, opponent.lives - result.opponentDamageTaken),
      board: clearDefeatedCards(opponent.board),
      isPassed: false,
    };

    const gameResult = getGameResult(nextPlayer, nextOpponent);

    if (gameResult) {
      playSound(...END_SOUNDS[gameResult]);
      if (tutorial) {
        markTutorialDone();
        set({ pendingCombatResult: null, gameResult, phase: 'end', player: nextPlayer, opponent: nextOpponent });
        return;
      }
      const stats = recordGameEnd(gameResult, difficulty, roundNumber, nextPlayer.lives === STARTING_LIVES);
      award(endStamps({
        result: gameResult, difficulty, rounds: roundNumber, livesLeft: nextPlayer.lives, startingLives: STARTING_LIVES,
        streak: stats.currentStreak, totalGames: stats.totalGames, track,
      }));
      set({ pendingCombatResult: null, gameResult, phase: 'end', player: nextPlayer, opponent: nextOpponent });
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
}));

// --- GUARDADO AUTOMÁTICO ---
// En tu turno de colocar el estado es estable: se guarda. Al terminar la partida o
// volver al menú desde una partida, se borra.
if (typeof window !== 'undefined') {
  useGameStore.subscribe((state, prev) => {
    if (state.screen === 'game' && state.phase === 'placement' && state.turn === 'player' && state.tutorialStep === null
      && (state.player !== prev.player || state.opponent !== prev.opponent || state.turn !== prev.turn)) {
      saveGame({ difficulty: state.difficulty, roundNumber: state.roundNumber, player: state.player, opponent: state.opponent });
    }
    if ((state.phase === 'end' && prev.phase !== 'end') || (state.screen === 'menu' && prev.screen === 'game')) clearGame();
  });
}
