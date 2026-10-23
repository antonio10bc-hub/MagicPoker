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
  /** Cartas del Castillo: no están en el mazo estándar */
  castle?: boolean;
  /** Bufón: copia el patrón de ataque de la carta de enfrente */
  copiesFront?: boolean;
  /** El As limpia el tablero entero */
  wipesBoard?: boolean;
  /** Las figuras muestran su sello sobre las cartas que destruyen */
  marksVictims?: boolean;
  /** Legendaria del mercader */
  legendary?: boolean;
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
  // --- Cartas del Castillo ---
  // Bufón: copia el ataque de la carta de enfrente (si no hay, ataca de frente)
  'JESTER': { value: 6, attack: FRONT, castle: true, copiesFront: true },
  // Torre: no ataca, pero vale 15: frena a cualquiera
  'TOWER': { value: 15, attack: null, castle: true },
  // Bomba: al caer en un choque, golpea los huecos rivales de al lado
  'BOMB': { value: 4, attack: FRONT, castle: true },
  // Espía: al ponerla, ves una carta de la mano del rival
  'SPY': { value: 3, attack: FRONT, castle: true },
  // Caballero: salta, golpea los huecos a dos de distancia
  'KNIGHT': { value: 9, attack: { offsets: [-2, 2], mode: 'all' }, castle: true },
  // Sacerdotisa: si sobrevive a la pelea, recuperas una vida
  'PRIESTESS': { value: 5, attack: FRONT, castle: true },
  // --- Legendarias (solo las vende el mercader o salen del cofre) ---
  // Dragón: vale 16 y golpea los tres huecos de delante
  'DRAGON': { value: 16, attack: { offsets: [-1, 0, 1], mode: 'all' }, castle: true, legendary: true },
  // Hidra: al caer en un choque deja un 5 en su hueco
  'HYDRA': { value: 7, attack: FRONT, castle: true, legendary: true },
  // Fénix: al caer vuelve a tu mano
  'PHOENIX': { value: 8, attack: FRONT, castle: true, legendary: true },
};

/** Cartas del Castillo (las ideas del catálogo hechas realidad) */
export const CASTLE_RANKS: Rank[] = ['JESTER', 'TOWER', 'BOMB', 'SPY', 'KNIGHT', 'PRIESTESS'];
/** Legendarias del mercader */
export const LEGENDARY_RANKS: Rank[] = ['DRAGON', 'HYDRA', 'PHOENIX'];

/** Rangos del mazo estándar (los sellos y las cartas del Castillo se añaden aparte) */
export const DECK_RANKS = (Object.keys(RANKS) as Rank[]).filter(r => r !== 'SEAL' && !RANKS[r].castle);

/** Una carta suelta (para las cartas nuevas del Castillo) */
export const createCard = (owner: Owner, rank: Rank, extra: Partial<Card> = {}): Card => ({
  id: `${owner}-${rank}-${++nextCardId}`, rank, suit: 'standard', value: RANKS[rank].value + (extra.bonus ?? 0), isFaceUp: false, owner, ...extra,
});

/** Comodín de sello: carta de sello sin sello fijo */
export const createWildSealCard = (owner: Owner): Card => ({
  id: `${owner}-SEAL-wild-${++nextCardId}`, rank: 'SEAL', suit: 'seal', value: 0, isFaceUp: false, owner, wild: true,
});

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
  | { kind: 'swap'; index: number; initiator: Owner }
  /** Un ancla ha impedido que la muevan o la roben */
  | { kind: 'anchor'; owner: Owner; index: number }
  /** Un sello de revelar ha expuesto esta carta */
  | { kind: 'reveal'; owner: Owner; index: number };

/** Valor en combate: una carta expuesta vale 1 menos */
export const combatValue = (card: Card): number => card.value - (card.isExposed ? 1 : 0);

/**
 * Sello de revelar: al ponerlo en el hueco `index`, se expone la carta rival de
 * enfrente; si no hay, la más cercana (antes las que están boca abajo). Devuelve el
 * tablero rival nuevo y el hueco expuesto, o null si no hay ninguna carta rival.
 */
export const applyReveal = (enemyBoard: BoardSlot[], index: number): { board: BoardSlot[]; index: number } | null => {
  const candidates = enemyBoard.filter(s => s.card && !s.card.isExposed)
    .sort((a, b) => Math.abs(a.index - index) - Math.abs(b.index - index) || Number(a.card!.isFaceUp) - Number(b.card!.isFaceUp));
  const target = candidates[0];
  if (!target) return null;
  const board = enemyBoard.map(s => (s.index === target.index ? { ...s, card: { ...s.card!, isFaceUp: true, isExposed: true } } : s));
  return { board, index: target.index };
};

/** Carta que deja un sello de eco al morir: un 2 boca arriba (la Hidra deja un 5) */
export const createEchoCard = (owner: Owner, rank: Rank = '2'): Card => ({
  id: `${owner}-${rank}-echo-${++nextCardId}`, rank, suit: 'standard', value: RANKS[rank].value, isFaceUp: true, owner,
});

/** Fénix caídos en la pelea: vuelven a la mano de su dueño (como carta nueva) */
export const risenPhoenixes = (board: BoardSlot[]): Card[] =>
  board.flatMap(s => (s.card?.rank === 'PHOENIX' && s.card.isTakingDamage
    ? [createCard(s.card.owner, 'PHOENIX', { isFaceUp: s.card.owner === 'player', merchant: s.card.merchant })]
    : []));

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
      // Ancla: no se mueve, así que el cambio no se hace
      if (other?.seal === 'anchor') {
        events.push({ kind: 'anchor', owner, index: to });
        return;
      }
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
      // Ancla: no te la pueden robar (el sello de robo espera)
      if (theirs.seal === 'anchor') {
        events.push({ kind: 'anchor', owner: enemy, index: i });
        return;
      }
      swapped.add(i);
      // Su carta pasa a ser mía y la mía (sin el sello, que se rompe) pasa a ser suya
      boards[owner][i] = { index: i, card: { ...theirs, owner, isFaceUp: true } };
      boards[enemy][i] = { index: i, card: { ...mine, owner: enemy, seal: undefined, isFaceUp: true } };
      events.push({ kind: 'swap', index: i, initiator: owner });
    });
  });

  return { player: boards.player, opponent: boards.opponent, events };
};

/**
 * Vidas que recupera cada bando: sus cartas con sello de vida que han muerto y sus
 * Sacerdotisas que siguen en pie
 */
export const lifeGains = (board: BoardSlot[], result: CombatResult): number => {
  const dead = new Set(result.deadCardIds);
  const blessed = new Set(result.blessedIds ?? []);
  return board.filter(s => (s.card?.seal === 'life' && dead.has(s.card.id)) || (s.card && blessed.has(s.card.id))).length;
};

// --- ESTADO DE JUGADOR (helpers puros) ---

export const createEmptyBoard = (): BoardSlot[] =>
  Array.from({ length: BOARD_SIZE }, (_, index) => ({ index, card: null }));

/** Sellos que puede traer como mucho la mano inicial (con más, la partida nace perdida) */
export const MAX_OPENING_SEALS = 1;

/**
 * La mano inicial lleva como mucho MAX_OPENING_SEALS sellos: los sobrantes se cambian
 * por las primeras cartas normales del resto del mazo (que pasan a la mano).
 */
export const limitOpeningSeals = (deck: Card[], handSize: number): Card[] => {
  const out = [...deck];
  let seals = 0;
  for (let i = 0; i < Math.min(handSize, out.length); i++) {
    if (!isSealCard(out[i])) continue;
    if (++seals <= MAX_OPENING_SEALS) continue;
    const j = out.findIndex((c, k) => k >= handSize && !isSealCard(c));
    if (j < 0) break;
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const createPlayerState = (deck: Card[] = [], handSize = 0, handFaceUp = false, lives = STARTING_LIVES): PlayerState => {
  const dealt = limitOpeningSeals(deck, handSize);
  return {
    lives,
    maxLives: lives,
    hand: dealt.slice(0, handSize).map(c => ({ ...c, isFaceUp: handFaceUp })),
    deck: dealt.slice(handSize),
    board: createEmptyBoard(),
    isPassed: false,
  };
};

/**
 * El robo de cada ronda: `amount` cartas del mazo, o, con un mazo de sellos aparte (el
 * Soberano), una carta de póker y un sello: así siempre tiene algo que poner en la mesa.
 */
export const drawRound = (state: PlayerState, amount: number, faceUp: boolean): PlayerState => {
  if (!state.sealDeck) return drawCards(state, amount, faceUp);
  const withCard = drawCards(state, 1, faceUp);
  const [seal, ...rest] = state.sealDeck;
  return seal ? { ...withCard, hand: [...withCard.hand, { ...seal, isFaceUp: faceUp }], sealDeck: rest } : withCard;
};

/** Le da un mazo de sellos aparte (y el primer sello a la mano inicial) */
export const withSealDeck = (state: PlayerState, seals: Card[], faceUp: boolean): PlayerState => {
  const [first, ...rest] = seals;
  return { ...state, hand: first ? [...state.hand, { ...first, isFaceUp: faceUp }] : state.hand, sealDeck: rest };
};

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
export const playCardToSlot = (state: PlayerState, cardId: string, slotIndex: number, faceUp: boolean, wildSeal?: SealId): PlayerState | null => {
  const card = state.hand.find(c => c.id === cardId);
  const slot = state.board[slotIndex];
  if (!card || !slot) return null;

  if (isSealCard(card)) {
    // Comodín de sello: hay que decir qué sello es
    const seal = card.wild ? wildSeal : card.seal;
    if (!seal || !slot.card || slot.card.seal) return null;
    const board = [...state.board];
    board[slotIndex] = { ...slot, card: { ...slot.card, seal } };
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

const targetsOf = (index: number, pattern: AttackPattern): number[] =>
  pattern.offsets.map(offset => index + offset).filter(i => i >= 0 && i < BOARD_SIZE);

export const getTargetIndices = (index: number, rank: Rank): number[] =>
  RANKS[rank].attack ? targetsOf(index, RANKS[rank].attack!) : [];

/** Patrón de ataque de una carta. El Bufón copia el de la carta que tiene enfrente. */
export const attackPattern = (card: Card, front: Card | null): AttackPattern | null => {
  const def = RANKS[card.rank];
  if (def.copiesFront && front && !RANKS[front.rank].copiesFront) return RANKS[front.rank].attack ?? def.attack;
  return def.attack;
};

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
      shieldHits: {},
      reflected: [],
      poisonedIds: [],
      isRepublicanaTriggered,
    };
  }

  // 2. CHOQUES: cada carta ataca a sus objetivos en el tablero contrario
  const deadIds = new Set<string>();
  // Sello de defensa: los golpes de toda la pelea no la matan (llegan a la vez)
  const shielded = new Set<string>();
  const shieldHits: Record<string, number> = {};
  const usedMirrors = new Map<string, string>();
  const reflected: CombatResult['reflected'] = [];
  const poisoned: string[] = [];
  /**
   * Golpe que mataría a `card`, dado por `by` (null: devuelto por un espejo o veneno,
   * que no se pueden devolver otra vez).
   */
  const kill = (card: Card, by: Card | null, byPoison = false) => {
    if (deadIds.has(card.id)) return;
    if (card.seal === 'shield') {
      shielded.add(card.id);
      shieldHits[card.id] = (shieldHits[card.id] ?? 0) + 1;
      return;
    }
    // Espejo: el primer golpe se devuelve al atacante (en un cara a cara, todo el
    // intercambio con esa carta cuenta como un solo golpe)
    if (card.seal === 'mirror' && by && usedMirrors.get(card.id) === by.id) return;
    if (card.seal === 'mirror' && by && !usedMirrors.has(card.id)) {
      usedMirrors.set(card.id, by.id);
      reflected.push({ mirrorId: card.id, attackerId: by.id });
      kill(by, null);
      return;
    }
    deadIds.add(card.id);
    if (byPoison) poisoned.push(card.id);
    // Veneno: quien la mata, muere con ella
    if (card.seal === 'poison' && by) kill(by, null, true);
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
    const a = combatValue(attacker);
    const d = combatValue(defender);
    if (a >= d) {
      kill(defender, attacker);
      if (a > d && RANKS[attacker.rank].marksVictims && deadIds.has(defender.id)) {
        damageSources[defender.id] = { rank: attacker.rank, owner: attacker.owner };
      }
    }
    if (a <= d) kill(attacker, defender);
  };

  const attack = (attackBoard: BoardSlot[], defenseBoard: BoardSlot[], defenderOwner: Owner) => {
    attackBoard.forEach(slot => {
      const attacker = slot.card;
      const pattern = attacker && attackPattern(attacker, defenseBoard[slot.index]?.card ?? null);
      if (!attacker || !pattern) return;

      const targets = targetsOf(slot.index, pattern);
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

  // Bombas: la que cae estalla y golpea los huecos rivales de al lado (cartas que mueren,
  // huecos vacíos que pierden una vida). Una bomba alcanzada también estalla.
  const exploded = new Set<string>();
  const bombVictims: string[] = [];
  const boards: Record<Owner, BoardSlot[]> = { player: playerBoard, opponent: opponentBoard };
  for (let changed = true; changed;) {
    changed = false;
    (['player', 'opponent'] as Owner[]).forEach(owner => {
      const enemy: Owner = owner === 'player' ? 'opponent' : 'player';
      boards[owner].forEach(slot => {
        const bomb = slot.card;
        if (bomb?.rank !== 'BOMB' || !deadIds.has(bomb.id) || exploded.has(bomb.id)) return;
        exploded.add(bomb.id);
        changed = true;
        [slot.index - 1, slot.index + 1].filter(i => i >= 0 && i < BOARD_SIZE).forEach(i => {
          const victim = boards[enemy][i].card;
          if (!victim) {
            damageTaken[enemy]++;
            emptyHits[enemy][i] = (emptyHits[enemy][i] ?? 0) + 1;
            return;
          }
          const wasDead = deadIds.has(victim.id);
          kill(victim, null);
          if (!wasDead && deadIds.has(victim.id)) bombVictims.push(victim.id);
        });
      });
    });
  }

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
    shieldHits,
    reflected: reflected.filter(r => !deadIds.has(r.mirrorId)),
    poisonedIds: poisoned,
    explodedIds: Array.from(exploded),
    bombVictimIds: bombVictims,
    // Sacerdotisas que siguen en pie: su dueño recupera una vida
    blessedIds: allCards.filter(c => c.rank === 'PRIESTESS' && !deadIds.has(c.id)).map(c => c.id),
    isRepublicanaTriggered,
  };
};

/** Marca en el tablero las cartas que mueren, se anulan o se salvan, para animarlas. */
export const markCombatResult = (board: BoardSlot[], result: CombatResult): BoardSlot[] => {
  const dead = new Set(result.deadCardIds);
  const voided = new Set(result.voidedCardIds);
  const shielded = new Set(result.shieldedIds);
  const mirrored = new Set(result.reflected.map(r => r.mirrorId));
  return board.map(slot => {
    const card = slot.card;
    if (card && shielded.has(card.id)) return { ...slot, card: { ...card, isShielded: true } };
    if (card && mirrored.has(card.id)) return { ...slot, card: { ...card, isReflecting: true } };
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

/**
 * Tras la pelea: se retiran las cartas caídas (el eco deja un 2), se rompen los sellos
 * de defensa y espejo usados y se acaba la exposición del sello de revelar.
 */
export const clearDefeatedCards = (board: BoardSlot[]): BoardSlot[] =>
  board.map(slot => {
    const card = slot.card;
    if (!card) return slot;
    if (card.isTakingDamage && card.seal === 'echo') return { ...slot, card: createEchoCard(card.owner) };
    if (card.isTakingDamage && card.rank === 'HYDRA') return { ...slot, card: { ...createEchoCard(card.owner, '5'), merchant: card.merchant } };
    if (card.isTakingDamage || card.isVoided) return { ...slot, card: null };
    if (card.isShielded || card.isReflecting) return { ...slot, card: { ...card, isShielded: false, isReflecting: false, isExposed: false, seal: undefined } };
    if (card.isExposed) return { ...slot, card: { ...card, isExposed: false } };
    return slot;
  });

export const revealBoard = (board: BoardSlot[]): BoardSlot[] =>
  board.map(slot => (slot.card && !slot.card.isFaceUp ? { ...slot, card: { ...slot.card, isFaceUp: true } } : slot));

// --- FIN DE PARTIDA ---

const hasRunOut = (s: PlayerState) => s.deck.length === 0 && s.hand.length === 0 && isBoardEmpty(s.board);

/**
 * Bloqueo: nadie tiene cartas en mano ni en mazo y la última pelea no cambió nada (sin
 * daño, sin cartas caídas, sin vidas recuperadas). Se repetiría para siempre: empate.
 */
export const isStalemate = (player: PlayerState, opponent: PlayerState, result: CombatResult): boolean => {
  const empty = (s: PlayerState) => s.deck.length === 0 && s.hand.length === 0;
  const nothing = result.playerDamageTaken === 0 && result.opponentDamageTaken === 0 && result.deadCardIds.length === 0
    && result.voidedCardIds.length === 0 && lifeGains(player.board, result) === 0 && lifeGains(opponent.board, result) === 0
    && (result.blessedIds?.length ?? 0) === 0;
  return empty(player) && empty(opponent) && nothing;
};

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
