import { BoardSlot, Card, CombatResult, DamageSource, GameResult, Owner, PlayerState, Rank, Rng } from '@/types';
import { BOARD_SIZE, STARTING_LIVES } from '@/lib/constants';

// --- DEFINICIÓN DE CARTAS ---
// Única fuente de verdad del comportamiento de cada rango: la usan el combate,
// la IA y las flechas de ataque de la carta.

export interface AttackPattern {
  /** Desplazamientos respecto a la columna propia (-1 izquierda, 0 frente, +1 derecha) */
  offsets: number[];
  /** 'all' golpea todos los objetivos; 'random-one' elige uno al azar */
  mode: 'all' | 'random-one';
}

interface RankDefinition {
  value: number;
  attack: AttackPattern | null;
  /** El As limpia el tablero entero */
  wipesBoard?: boolean;
  /** Las figuras muestran su sello sobre las cartas que destruyen */
  marksVictims?: boolean;
}

const FRONT: AttackPattern = { offsets: [0], mode: 'all' };

export const RANKS: Record<Rank, RankDefinition> = {
  '2': { value: 2, attack: FRONT },
  '3': { value: 3, attack: FRONT },
  '4': { value: 4, attack: FRONT },
  '5': { value: 5, attack: FRONT },
  '6': { value: 6, attack: FRONT },
  '7': { value: 7, attack: FRONT },
  '8': { value: 8, attack: FRONT },
  '9': { value: 9, attack: FRONT },
  '10': { value: 10, attack: FRONT },
  'J': { value: 11, attack: { offsets: [-1, 0, 1], mode: 'random-one' }, marksVictims: true },
  'Q': { value: 12, attack: { offsets: [-1, 1], mode: 'all' }, marksVictims: true },
  'K': { value: 13, attack: { offsets: [-1, 0, 1], mode: 'all' }, marksVictims: true },
  'A': { value: 14, attack: null, wipesBoard: true },
  'JOKER': { value: 0, attack: null },
};

const DECK_RANKS = Object.keys(RANKS) as Rank[];

export const getCardValue = (rank: Rank): number => RANKS[rank].value;

// --- MAZO ---

let nextCardId = 0;

/** Fisher–Yates: barajado uniforme (sort con random está sesgado). */
export const shuffle = <T,>(items: T[], rng: Rng = Math.random): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

export const createDeck = (owner: Owner, rng: Rng = Math.random): Card[] =>
  shuffle(
    DECK_RANKS.map(rank => ({
      id: `${owner}-${rank}-${++nextCardId}`,
      rank,
      suit: rank === 'JOKER' ? 'joker' : 'standard',
      value: RANKS[rank].value,
      isFaceUp: false,
      owner,
    })),
    rng
  );

// --- ESTADO DE JUGADOR (helpers puros) ---

export const createEmptyBoard = (): BoardSlot[] =>
  Array.from({ length: BOARD_SIZE }, (_, index) => ({ index, card: null }));

export const createPlayerState = (deck: Card[] = [], handSize = 0, handFaceUp = false): PlayerState => ({
  lives: STARTING_LIVES,
  hand: deck.slice(0, handSize).map(c => ({ ...c, isFaceUp: handFaceUp })),
  deck: deck.slice(handSize),
  board: createEmptyBoard(),
  isPassed: false,
});

export const drawCards = (state: PlayerState, amount: number, faceUp: boolean): PlayerState => {
  if (amount <= 0 || state.deck.length === 0) return state;
  const drawn = state.deck.slice(0, amount).map(c => ({ ...c, isFaceUp: faceUp }));
  return { ...state, hand: [...state.hand, ...drawn], deck: state.deck.slice(amount) };
};

/** Mueve una carta de la mano al hueco indicado. Devuelve null si no es posible. */
export const playCardToSlot = (state: PlayerState, cardId: string, slotIndex: number, faceUp: boolean): PlayerState | null => {
  const card = state.hand.find(c => c.id === cardId);
  const slot = state.board[slotIndex];
  if (!card || !slot || slot.card) return null;

  const board = [...state.board];
  board[slotIndex] = { ...slot, card: { ...card, isFaceUp: faceUp } };
  return { ...state, hand: state.hand.filter(c => c.id !== cardId), board };
};

export const countRankOnBoard = (board: BoardSlot[], rank: Rank): number =>
  board.reduce((n, s) => (s.card?.rank === rank ? n + 1 : n), 0);

export const getAvailableSlots = (board: BoardSlot[]): number[] =>
  board.filter(s => s.card === null).map(s => s.index);

export const isBoardEmpty = (board: BoardSlot[]): boolean => board.every(s => s.card === null);

// --- COMBATE ---

export const getTargetIndices = (index: number, rank: Rank): number[] =>
  (RANKS[rank].attack?.offsets ?? [])
    .map(offset => index + offset)
    .filter(i => i >= 0 && i < BOARD_SIZE);

const boardCards = (board: BoardSlot[]): Card[] =>
  board.flatMap(s => (s.card ? [s.card] : []));

export const calculateCombat = (playerBoard: BoardSlot[], opponentBoard: BoardSlot[], rng: Rng = Math.random): CombatResult => {
  const damageSources: Record<string, DamageSource> = {};
  const playerCards = boardCards(playerBoard);
  const opponentCards = boardCards(opponentBoard);

  // Logro "Republicana": el jugador usa un AS y el rival tiene J, Q y K en mesa
  const opponentRanks = new Set(opponentCards.map(c => c.rank));
  const isRepublicanaTriggered =
    playerCards.some(c => c.rank === 'A') && ['J', 'Q', 'K'].every(r => opponentRanks.has(r as Rank));

  // 1. REGLA DEL AS (Board Wipe): anula todas las cartas de ambos lados
  const allCards = [...playerCards, ...opponentCards];
  const wiper = allCards.find(c => RANKS[c.rank].wipesBoard);
  if (wiper) {
    allCards.forEach(c => { damageSources[c.id] = { rank: wiper.rank, owner: wiper.owner }; });
    return {
      playerDamageTaken: 0,
      opponentDamageTaken: 0,
      deadCardIds: [],
      voidedCardIds: allCards.map(c => c.id),
      playerEmptySlotsHit: {},
      opponentEmptySlotsHit: {},
      damageSources,
      cardsDestroyedCount: 0,
      isRepublicanaTriggered,
    };
  }

  // 2. CHOQUES: cada carta ataca a sus objetivos en el tablero contrario
  const deadIds = new Set<string>();
  const emptyHits: Record<Owner, Record<number, number>> = { player: {}, opponent: {} };
  const damageTaken: Record<Owner, number> = { player: 0, opponent: 0 };

  const resolveHit = (attacker: Card, target: BoardSlot, defenderOwner: Owner) => {
    const defender = target.card;
    if (!defender) {
      damageTaken[defenderOwner]++;
      emptyHits[defenderOwner][target.index] = (emptyHits[defenderOwner][target.index] ?? 0) + 1;
      return;
    }
    if (attacker.value >= defender.value) {
      deadIds.add(defender.id);
      if (attacker.value > defender.value && RANKS[attacker.rank].marksVictims) {
        damageSources[defender.id] = { rank: attacker.rank, owner: attacker.owner };
      }
    }
    if (attacker.value <= defender.value) deadIds.add(attacker.id);
  };

  const attack = (attackBoard: BoardSlot[], defenseBoard: BoardSlot[], defenderOwner: Owner) => {
    attackBoard.forEach(slot => {
      const attacker = slot.card;
      const pattern = attacker && RANKS[attacker.rank].attack;
      if (!attacker || !pattern) return;

      const targets = getTargetIndices(slot.index, attacker.rank);
      if (targets.length === 0) return;

      const chosen = pattern.mode === 'random-one'
        ? [targets[Math.floor(rng() * targets.length)]]
        : targets;
      chosen.forEach(i => resolveHit(attacker, defenseBoard[i], defenderOwner));
    });
  };

  attack(playerBoard, opponentBoard, 'opponent');
  attack(opponentBoard, playerBoard, 'player');

  return {
    playerDamageTaken: damageTaken.player,
    opponentDamageTaken: damageTaken.opponent,
    deadCardIds: Array.from(deadIds),
    voidedCardIds: [],
    playerEmptySlotsHit: emptyHits.player,
    opponentEmptySlotsHit: emptyHits.opponent,
    damageSources,
    cardsDestroyedCount: deadIds.size,
    isRepublicanaTriggered,
  };
};

/** Marca en el tablero las cartas que mueren o se anulan para animarlas. */
export const markCombatResult = (board: BoardSlot[], result: CombatResult): BoardSlot[] => {
  const dead = new Set(result.deadCardIds);
  const voided = new Set(result.voidedCardIds);
  return board.map(slot => {
    const card = slot.card;
    if (!card || (!dead.has(card.id) && !voided.has(card.id))) return slot;
    return {
      ...slot,
      card: {
        ...card,
        ...(dead.has(card.id) ? { isTakingDamage: true } : { isVoided: true }),
        damageSource: result.damageSources[card.id],
      },
    };
  });
};

export const clearDefeatedCards = (board: BoardSlot[]): BoardSlot[] =>
  board.map(slot => (slot.card?.isTakingDamage || slot.card?.isVoided ? { ...slot, card: null } : slot));

export const revealBoard = (board: BoardSlot[]): BoardSlot[] =>
  board.map(slot => (slot.card && !slot.card.isFaceUp ? { ...slot, card: { ...slot.card, isFaceUp: true } } : slot));

// --- FIN DE PARTIDA ---

const hasRunOut = (s: PlayerState) => s.deck.length === 0 && s.hand.length === 0 && isBoardEmpty(s.board);

/** Devuelve el resultado si la partida ha terminado, o null si sigue. */
export const getGameResult = (player: PlayerState, opponent: PlayerState): GameResult | null => {
  if (player.lives === 0 && opponent.lives === 0) return 'draw';
  if (player.lives === 0) return 'loss';
  if (opponent.lives === 0) return 'win';

  const playerOut = hasRunOut(player);
  const opponentOut = hasRunOut(opponent);
  if (playerOut && opponentOut) return 'draw';
  if (playerOut && !isBoardEmpty(opponent.board)) return 'loss';
  if (opponentOut && !isBoardEmpty(player.board)) return 'win';
  return null;
};
