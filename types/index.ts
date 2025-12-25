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

export type GamePhase = 'start' | 'placement' | 'combat' | 'end';

// NUEVO: Para saber qué slots han recibido daño directo y pintar el -1
export interface DamageEvent {
  playerSlots: number[];   // Índices donde el jugador recibió daño (huecos vacíos suyos)
  opponentSlots: number[]; // Índices donde el rival recibió daño
}