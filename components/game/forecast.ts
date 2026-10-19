import { BoardSlot, Card, Rank } from '@/types';
import { getTargetIndices, RANKS } from '@/lib/game-utils';

// --- PRONÓSTICOS CON INFORMACIÓN VISIBLE ---
// Ayudas de lectura para el jugador. Usan las mismas reglas que lib/game-utils (solo
// lectura) y nunca miran las cartas boca abajo del rival: una carta oculta se trata
// como "podría golpear el hueco de delante".

/**
 * Huecos tuyos en peligro. Una carta rival destapada amenaza exactamente los huecos de
 * su patrón: la Reina, solo en diagonal; el As y el Joker, ninguno. Boca abajo no se
 * sabe qué es, así que solo se avisa del hueco que tiene justo delante.
 */
export const threatsFrom = (opponentBoard: BoardSlot[]): boolean[] => {
  const threats = opponentBoard.map(() => false);
  opponentBoard.forEach(s => {
    if (!s.card) return;
    if (!s.card.isFaceUp) threats[s.index] = true;
    else getTargetIndices(s.index, s.card.rank).forEach(i => { threats[i] = true; });
  });
  return threats;
};

export interface Forecast {
  /** Golpes que seguro llegan a un hueco vacío (cada uno quita una vida) */
  sure: number;
  /** Golpes que pueden llegar (Príncipe al azar, cartas ocultas) */
  maybe: number;
}

/** Golpes de `attackers` contra los huecos vacíos de `defenders` */
const hitsOnEmpty = (attackers: BoardSlot[], defenders: BoardSlot[]): Forecast => {
  const out: Forecast = { sure: 0, maybe: 0 };
  // Un As en mesa anula todas las cartas: nadie golpea
  if (attackers.concat(defenders).some(s => s.card?.isFaceUp && RANKS[s.card.rank].wipesBoard)) return out;
  attackers.forEach(s => {
    if (!s.card) return;
    if (!s.card.isFaceUp) {
      if (!defenders[s.index].card) out.maybe++;
      return;
    }
    const attack = RANKS[s.card.rank].attack;
    if (!attack) return;
    const empty = getTargetIndices(s.index, s.card.rank).filter(i => !defenders[i].card);
    if (attack.mode === 'random-one') out.maybe += empty.length > 0 ? 1 : 0;
    else out.sure += empty.length;
  });
  return out;
};

/** Lo que pasaría si la pelea empezase ahora: tu daño al rival y tu exposición */
export const forecastFight = (playerBoard: BoardSlot[], opponentBoard: BoardSlot[]) => ({
  dealt: hitsOnEmpty(playerBoard, opponentBoard),
  taken: hitsOnEmpty(opponentBoard, playerBoard),
});

/** Cartas que quedan en un mazo, agrupadas por rango (sin revelar el orden) */
export const deckSummary = (deck: Card[]): { rank: Rank; count: number }[] => {
  const order: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', 'JOKER'];
  const counts = new Map<Rank, number>();
  deck.forEach(c => counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1));
  return order.map(rank => ({ rank, count: counts.get(rank) ?? 0 }));
};
