export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'joker';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'JOKER';

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
  value: number; // Valor numérico para comparar (J=11, Q=12, K=13, A=14, Joker=?)
  isFaceUp: boolean;
  owner: 'player' | 'opponent';
}

export type SlotIndex = 0 | 1 | 2 | 3;

export interface BoardSlot {
  index: SlotIndex;
  card: Card | null;
}

export interface PlayerState {
  lives: number;
  hand: Card[];
  board: BoardSlot[]; // Array de 4 slots
  isPassed: boolean; // Si se ha plantado
}

export type GamePhase = 'start' | 'placement' | 'combat' | 'end';