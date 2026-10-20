import { BoardSlot, Card, CombatResult, DamageSource, GameResult, Owner, PlayerState, Rank, Rng, SealId } from '@/types';
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
  // Carta de sello: no se coloca en un hueco, se aplica sobre una carta propia
  'SEAL': { value: 0, attack: null },
};

/** Rangos del mazo estándar (los sellos se añaden aparte) */
const DECK_RANKS = (Object.keys(RANKS) as Rank[]).filter(r => r !== 'SEAL');

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

// --- SELLOS ---

export const isSealCard = (card: Card): boolean => card.rank === 'SEAL';

export const createSealCard = (owner: Owner, seal: SealId): Card => ({
  id: `${owner}-SEAL-${seal}-${++nextCardId}`, rank: 'SEAL', suit: 'seal', value: 0, isFaceUp: false, owner, seal,
});

/** Huecos con una carta propia sin sello: donde se puede aplicar uno */
export const getSealTargets = (board: BoardSlot[]): number[] =>
  board.filter(s => s.card && !s.card.seal).map(s => s.index);

export type SealEvent =
  | { kind: 'shift'; owner: Owner; from: number; to: number }
  | { kind: 'swap'; index: number; initiator: Owner };

/**
 * Efectos de sello que ocurren al empezar la pelea, antes del choque:
 *  1. Cambio (shift): cada carta con este sello se cambia con el hueco de su derecha
 *     (del último salta al primero), aunque esté vacío. Cada carta se mueve una vez.
 *  2. Cambio con enemigo (swap): la carta se cambia de bando con la de enfrente (si la
 *     hay) y el sello se rompe. Sin carta enfrente, el sello espera.
 */
export const applyPreCombatSeals = (playerBoard: BoardSlot[], opponentBoard: BoardSlot[]) => {
  const events: SealEvent[] = [];
  const boards: Record<Owner, BoardSlot[]> = {
    player: playerBoard.map(s => ({ ...s })),
    opponent: opponentBoard.map(s => ({ ...s })),
  };

  (['player', 'opponent'] as Owner[]).forEach(owner => {
    const board = boards[owner];
    const moved = new Set<string>();
    const shifters = board.filter(s => s.card?.seal === 'shift').map(s => s.card!.id);
    shifters.forEach(id => {
      if (moved.has(id)) return;
      const from = board.findIndex(s => s.card?.id === id);
      const to = (from + 1) % board.length;
      const other = board[to].card;
      board[to] = { index: to, card: board[from].card };
      board[from] = { index: from, card: other };
      moved.add(id);
      if (other) moved.add(other.id);
      events.push({ kind: 'shift', owner, from, to });
    });
  });

  const swapped = new Set<number>();
  (['player', 'opponent'] as Owner[]).forEach(owner => {
    const enemy: Owner = owner === 'player' ? 'opponent' : 'player';
    boards[owner].forEach((slot, i) => {
      const mine = slot.card;
      const theirs = boards[enemy][i].card;
      if (mine?.seal !== 'swap' || !theirs || swapped.has(i)) return;
      swapped.add(i);
      // Su carta pasa a ser mía y la mía (sin el sello, que se rompe) pasa a ser suya
      boards[owner][i] = { index: i, card: { ...theirs, owner, isFaceUp: true } };
      boards[enemy][i] = { index: i, card: { ...mine, owner: enemy, seal: undefined, isFaceUp: true } };
      events.push({ kind: 'swap', index: i, initiator: owner });
    });
  });

  return { player: boards.player, opponent: boards.opponent, events };
};

/** Vidas que recupera cada bando por sus cartas con sello de vida que han muerto */
export const lifeGains = (board: BoardSlot[], result: CombatResult): number => {
  const dead = new Set(result.deadCardIds);
  return board.filter(s => s.card?.seal === 'life' && dead.has(s.card.id)).length;
};

// --- ESTADO DE JUGADOR (helpers puros) ---

export const createEmptyBoard = (): BoardSlot[] =>
  Array.from({ length: BOARD_SIZE }, (_, index) => ({ index, card: null }));

export const createPlayerState = (deck: Card[] = [], handSize = 0, handFaceUp = false, lives = STARTING_LIVES): PlayerState => ({
  lives,
  maxLives: lives,
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

/**
 * Juega una carta de la mano en el hueco indicado. Una carta normal va a un hueco
 * vacío; una de sello se aplica sobre la carta propia (sin sello) de ese hueco.
 * Devuelve null si no es posible.
 */
export const playCardToSlot = (state: PlayerState, cardId: string, slotIndex: number, faceUp: boolean): PlayerState | null => {
  const card = state.hand.find(c => c.id === cardId);
  const slot = state.board[slotIndex];
  if (!card || !slot) return null;

  if (isSealCard(card)) {
    if (!slot.card || slot.card.seal) return null;
    const board = [...state.board];
    board[slotIndex] = { ...slot, card: { ...slot.card, seal: card.seal } };
    return { ...state, hand: state.hand.filter(c => c.id !== cardId), board };
  }
  if (slot.card) return null;

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
      deadByOwner: { player: 0, opponent: 0 },
      shieldedIds: [],
      isRepublicanaTriggered,
    };
  }

  // 2. CHOQUES: cada carta ataca a sus objetivos en el tablero contrario
  const deadIds = new Set<string>();
  // Sello de defensa: los golpes de toda la pelea no la matan (llegan a la vez)
  const shielded = new Set<string>();
  const kill = (card: Card) => {
    if (card.seal === 'shield') shielded.add(card.id);
    else deadIds.add(card.id);
  };
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
      kill(defender);
      if (attacker.value > defender.value && RANKS[attacker.rank].marksVictims && defender.seal !== 'shield') {
        damageSources[defender.id] = { rank: attacker.rank, owner: attacker.owner };
      }
    }
    if (attacker.value <= defender.value) kill(attacker);
  };

  const attack = (attackBoard: BoardSlot[], defenseBoard: BoardSlot[], defenderOwner: Owner) => {
    attackBoard.forEach(slot => {
      const attacker = slot.card;
      const pattern = attacker && RANKS[attacker.rank].attack;
      if (!attacker || !pattern) return;

      const targets = getTargetIndices(slot.index, attacker.rank);
      if (targets.length === 0) return;

      // Sello de ataque: ataca dos veces (el Príncipe elige objetivo cada vez)
      const times = attacker.seal === 'double' ? 2 : 1;
      for (let n = 0; n < times; n++) {
        const chosen = pattern.mode === 'random-one'
          ? [targets[Math.floor(rng() * targets.length)]]
          : targets;
        chosen.forEach(i => resolveHit(attacker, defenseBoard[i], defenderOwner));
      }
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
    deadByOwner: {
      player: playerCards.filter(c => deadIds.has(c.id)).length,
      opponent: opponentCards.filter(c => deadIds.has(c.id)).length,
    },
    shieldedIds: Array.from(shielded).filter(id => !deadIds.has(id)),
    isRepublicanaTriggered,
  };
};

/** Marca en el tablero las cartas que mueren, se anulan o se salvan, para animarlas. */
export const markCombatResult = (board: BoardSlot[], result: CombatResult): BoardSlot[] => {
  const dead = new Set(result.deadCardIds);
  const voided = new Set(result.voidedCardIds);
  const shielded = new Set(result.shieldedIds);
  return board.map(slot => {
    const card = slot.card;
    if (card && shielded.has(card.id)) return { ...slot, card: { ...card, isShielded: true } };
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

/** Tras la pelea: se retiran las cartas caídas y se rompen los sellos de defensa usados */
export const clearDefeatedCards = (board: BoardSlot[]): BoardSlot[] =>
  board.map(slot => {
    const card = slot.card;
    if (card?.isTakingDamage || card?.isVoided) return { ...slot, card: null };
    if (card?.isShielded) return { ...slot, card: { ...card, isShielded: false, seal: undefined } };
    return slot;
  });

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
