import { BoardSlot, Card, Difficulty, Rng, SealId } from '@/types';
import { getAvailableSlots, getSealTargets, isSealCard, RANKS } from '@/lib/game-utils';

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

// --- SELLOS DEL RIVAL (bosses) ---
// Cada sello busca la carta propia donde rinde más. Devuelve null si no conviene.
const value = (s: BoardSlot) => s.card?.value ?? 0;
/** La carta tuya más fuerte que golpea a este hueco (la de enfrente o las vecinas) */
const threat = (s: BoardSlot, pb: BoardSlot[]) =>
  Math.max(0, ...[s.index - 1, s.index, s.index + 1].map(i => pb[i]?.card?.value ?? 0));
const SEAL_TARGET: Record<SealId, (targets: BoardSlot[], playerBoard: BoardSlot[]) => BoardSlot | null> = {
  // Defensa: la carta que más arriesga (tiene una tuya delante), y si no, la mejor
  shield: (t, pb) => [...t].sort((a, b) => Number(!!pb[b.index].card) - Number(!!pb[a.index].card) || value(b) - value(a))[0],
  // Ataque doble: la carta más fuerte que ataque
  double: t => [...t].filter(s => RANKS[s.card!.rank].attack).sort((a, b) => value(b) - value(a))[0] ?? null,
  // Cambio: cualquiera (la de menor valor, para recolocarla)
  shift: t => [...t].sort((a, b) => value(a) - value(b))[0],
  // Cambio con enemigo: robarte tu mejor carta, si hay alguna delante de las suyas
  swap: (t, pb) => [...t].filter(s => pb[s.index].card).sort((a, b) => value(pb[b.index]) - value(pb[a.index]))[0] ?? null,
  // Vida: la carta con más números de caer (la más débil)
  life: t => [...t].sort((a, b) => value(a) - value(b))[0],
  // Espejo: la que tiene delante la carta tuya más fuerte (le devolverá el golpe)
  mirror: (t, pb) => [...t].filter(s => threat(s, pb) > 0).sort((a, b) => threat(b, pb) - threat(a, pb))[0] ?? null,
  // Veneno: la que va a caer (tiene delante una tuya más fuerte), para llevársela
  poison: (t, pb) => [...t].filter(s => threat(s, pb) >= value(s)).sort((a, b) => value(a) - value(b))[0] ?? null,
  // Eco: la más débil, que dejará un 2 al caer
  echo: t => [...t].sort((a, b) => value(a) - value(b))[0],
  // Ancla: la mejor, para que no se la quiten
  anchor: t => [...t].sort((a, b) => value(b) - value(a))[0],
  // Revelar: solo si tienes alguna carta en la mesa (la expone)
  reveal: (t, pb) => (pb.some(s => s.card) ? [...t].sort((a, b) => value(pb[b.index]) - value(pb[a.index]))[0] : null),
};

const sealMove = (hand: Card[], opponentBoard: BoardSlot[], playerBoard: BoardSlot[]): OpponentMove | null => {
  const targets = getSealTargets(opponentBoard).map(i => opponentBoard[i]);
  if (targets.length === 0) return null;
  for (const card of hand.filter(isSealCard)) {
    const target = SEAL_TARGET[card.seal!](targets, playerBoard);
    if (target) return { cardId: card.id, slotIndex: target.index };
  }
  return null;
};

/** Decide qué carta juega el rival y dónde. Devuelve null si debe plantarse. */
export const chooseOpponentMove = (
  hand: Card[],
  opponentBoard: BoardSlot[],
  playerBoard: BoardSlot[],
  difficulty: Difficulty,
  rng: Rng = Math.random
): OpponentMove | null => {
  // Los bosses usan su sello en cuanto tienen dónde ponerlo
  const seal = sealMove(hand, opponentBoard, playerBoard);
  if (seal) return seal;

  const card = hand.find(c => !isSealCard(c));
  const available = getAvailableSlots(opponentBoard);
  if (!card || available.length === 0) return null;

  const defensive = available.filter(i => playerBoard[i].card !== null);
  return { cardId: card.id, slotIndex: STRATEGIES[difficulty](card, available, defensive, playerBoard, rng) };
};
