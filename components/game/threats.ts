import { BoardSlot } from '@/types';
import { getTargetIndices } from '@/lib/game-utils';

/**
 * Huecos tuyos en peligro (solo con información visible). Una carta rival destapada
 * amenaza exactamente los huecos de su patrón: la Reina, solo en diagonal; el As y el
 * Joker, ninguno. Boca abajo no se sabe qué es, así que solo se avisa del hueco que
 * tiene justo delante.
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
