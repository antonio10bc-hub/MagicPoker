import { BoardSlot, Card, Difficulty, Rng } from '@/types';
import { getAvailableSlots } from '@/lib/game-utils';

const pickRandom = <T,>(items: T[], rng: Rng): T => items[Math.floor(rng() * items.length)];

/** Probabilidad de que el rival en "normal" se coloque frente a una carta tuya */
const NORMAL_DEFENSIVE_CHANCE = 0.3;

type Strategy = (card: Card, available: number[], defensive: number[], playerBoard: BoardSlot[], rng: Rng) => number;

const STRATEGIES: Record<Difficulty, Strategy> = {
  easy: (_card, available, _defensive, _board, rng) => pickRandom(available, rng),

  normal: (_card, available, defensive, _board, rng) =>
    defensive.length > 0 && rng() < NORMAL_DEFENSIVE_CHANCE
      ? pickRandom(defensive, rng)
      : pickRandom(available, rng),

  // Busca un hueco donde su carta gane a la tuya; si no, se pone delante de alguna; si no, al azar
  hard: (card, available, defensive, playerBoard, rng) => {
    const winning = defensive.find(i => card.value > (playerBoard[i].card?.value ?? Infinity));
    if (winning !== undefined) return winning;
    return pickRandom(defensive.length > 0 ? defensive : available, rng);
  },
};

export interface OpponentMove {
  cardId: string;
  slotIndex: number;
}

/** Decide qué carta juega el rival y dónde. Devuelve null si debe plantarse. */
export const chooseOpponentMove = (
  hand: Card[],
  opponentBoard: BoardSlot[],
  playerBoard: BoardSlot[],
  difficulty: Difficulty,
  rng: Rng = Math.random
): OpponentMove | null => {
  const card = hand[0];
  const available = getAvailableSlots(opponentBoard);
  if (!card || available.length === 0) return null;

  const defensive = available.filter(i => playerBoard[i].card !== null);
  return { cardId: card.id, slotIndex: STRATEGIES[difficulty](card, available, defensive, playerBoard, rng) };
};
