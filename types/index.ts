export type Owner = 'player' | 'opponent';
export type Suit = 'standard' | 'joker';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | 'JOKER';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Screen = 'menu' | 'game';
export type GameResult = 'win' | 'loss' | 'draw';
export type GamePhase = 'start' | 'placement' | 'combat' | 'combat-reveal' | 'end';

export interface DamageSource {
  rank: Rank;
  owner: Owner;
}

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
  value: number;
  isFaceUp: boolean;
  owner: Owner;
  isTakingDamage?: boolean;
  isVoided?: boolean;
  damageSource?: DamageSource;
}

export interface BoardSlot {
  index: number;
  card: Card | null;
}

export interface PlayerState {
  lives: number;
  hand: Card[];
  board: BoardSlot[];
  deck: Card[];
  isPassed: boolean;
}

export interface CombatResult {
  playerDamageTaken: number;
  opponentDamageTaken: number;
  deadCardIds: string[];
  voidedCardIds: string[];
  /** Daño directo recibido por cada hueco vacío (índice → daño) */
  playerEmptySlotsHit: Record<number, number>;
  opponentEmptySlotsHit: Record<number, number>;
  damageSources: Record<string, DamageSource>;
  /** Cartas destruidas en choque (las anuladas por el As no cuentan) */
  cardsDestroyedCount: number;
  /** Logro "La Republicana": el jugador usa un As contra J, Q y K rivales */
  isRepublicanaTriggered: boolean;
}

/** Generador de números aleatorios en [0, 1). Inyectable para tests. */
export type Rng = () => number;
