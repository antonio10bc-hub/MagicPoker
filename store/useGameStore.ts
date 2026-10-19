import { create } from 'zustand';
import { CombatResult, Difficulty, GamePhase, GameResult, Owner, PlayerState, Screen } from '@/types';
import {
  calculateCombat, clearDefeatedCards, countRankOnBoard, createDeck, createPlayerState,
  drawCards, getGameResult, markCombatResult, playCardToSlot, revealBoard,
} from '@/lib/game-utils';
import { chooseOpponentMove } from '@/lib/ai';
import { playSound } from '@/lib/sounds';
import { incrementStat, recordWin, unlockRepublicana } from '@/lib/stats';
import { CARDS_DRAWN_PER_ROUND, JOKER_DRAW_BONUS, STARTING_HAND_SIZE, TIMINGS } from '@/lib/constants';

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

  setDifficulty: (diff: Difficulty) => void;
  startGame: () => void;
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

const initialMatchState = () => ({
  phase: 'start' as GamePhase,
  turn: 'player' as Owner,
  roundNumber: 1,
  pendingCombatResult: null,
  gameResult: null,
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

    set({
      ...initialMatchState(),
      screen: 'game',
      phase: 'placement',
      player: createPlayerState(createDeck('player'), STARTING_HAND_SIZE, true),
      opponent: createPlayerState(createDeck('opponent'), STARTING_HAND_SIZE, false),
    });
  },

  exitToMenu: () => {
    cancelScheduled();
    set({ ...initialMatchState(), screen: 'menu' });
  },

  drawCard: (target, amount = 1) => {
    set(state => ({ [target]: drawCards(state[target], amount, target === 'player') }));
  },

  placeCard: (cardId, slotIndex) => {
    const { player, opponent, turn, phase } = get();
    if (phase !== 'placement' || turn !== 'player' || player.isPassed) return;

    const nextPlayer = playCardToSlot(player, cardId, slotIndex, true);
    if (!nextPlayer) return;

    playSound('click', 0.5);
    incrementStat('cardsPlayed');

    // Si el rival ya se plantó, sigues jugando tú
    set({ player: nextPlayer, turn: opponent.isPassed ? 'player' : 'opponent' });
    if (!opponent.isPassed) schedule(get().opponentTurnAction, TIMINGS.opponentThink);
  },

  passTurn: () => {
    const { phase, turn, player, opponent } = get();
    if (phase !== 'placement' || turn !== 'player' || player.isPassed) return;

    playSound('click');
    set({ player: { ...player, isPassed: true }, turn: 'opponent' });

    if (opponent.isPassed) get().resolveCombatPhase();
    else schedule(get().opponentTurnAction, TIMINGS.opponentThink);
  },

  opponentTurnAction: () => {
    const { opponent, player, difficulty, phase } = get();
    if (phase !== 'placement') return;

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
        const { player, opponent } = get();
        const result = calculateCombat(player.board, opponent.board);

        if (result.cardsDestroyedCount > 0) incrementStat('cardsDestroyed', result.cardsDestroyedCount);
        if (result.isRepublicanaTriggered) unlockRepublicana();
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
    const { phase, pendingCombatResult: result, player, opponent, difficulty, roundNumber } = get();
    if (phase !== 'combat-reveal') return;

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
      if (gameResult === 'win') recordWin(difficulty);
      set({ pendingCombatResult: null, gameResult, phase: 'end', player: nextPlayer, opponent: nextOpponent });
      return;
    }

    set({
      pendingCombatResult: null,
      phase: 'placement',
      turn: 'player',
      roundNumber: roundNumber + 1,
      player: drawCards(nextPlayer, CARDS_DRAWN_PER_ROUND, true),
      opponent: drawCards(nextOpponent, CARDS_DRAWN_PER_ROUND, false),
    });
  },
}));
