export type Suit = 'standard' | 'joker';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | 'JOKER';

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
  value: number;
  isFaceUp: boolean;
  owner: 'player' | 'opponent';
  isTakingDamage?: boolean;
  isVoided?: boolean;
  damageSource?: { rank: Rank; owner: 'player' | 'opponent' };
}

export type SlotIndex = 0 | 1 | 2 | 3;

export interface BoardSlot {
  index: SlotIndex;
  card: Card | null;
}

export interface PlayerState {
  lives: number;
  hand: Card[];
  board: BoardSlot[];
  deck: Card[];
  isPassed: boolean;
}

export type GamePhase = 'start' | 'placement' | 'combat' | 'combat-reveal' | 'end';

export interface DamageEvent {
  playerSlots: Record<number, number>;
  opponentSlots: Record<number, number>;
}

// NUEVO: Movido aquí para que el Store lo reconozca
export interface CombatResult {
  playerDamageTaken: number;
  opponentDamageTaken: number;
  deadCardIds: string[];
  voidedCardIds: string[];
  playerEmptySlotsHit: Record<number, number>;
  opponentEmptySlotsHit: Record<number, number>;
  damageSources: Record<string, { rank: Rank, owner: 'player' | 'opponent' }>;
}