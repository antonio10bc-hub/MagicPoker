import { describe, expect, it } from 'vitest';
import { BoardSlot, Rank } from '@/types';
import { createEmptyBoard, RANKS } from '@/lib/game-utils';
import { threatsFrom } from './threats';

const rival = (slots: ({ rank: Rank; faceUp: boolean } | null)[]): BoardSlot[] =>
  createEmptyBoard().map((slot, i) => {
    const c = slots[i];
    return { ...slot, card: c ? { id: `o-${i}`, rank: c.rank, owner: 'opponent', suit: 'standard', value: RANKS[c.rank].value, isFaceUp: c.faceUp } : null };
  });

describe('threatsFrom', () => {
  it('a face-up Queen threatens only the diagonals, not the slot in front', () => {
    expect(threatsFrom(rival([null, { rank: 'Q', faceUp: true }, null, null]))).toEqual([true, false, true, false]);
  });

  it('a face-down card only warns about the slot in front', () => {
    expect(threatsFrom(rival([null, { rank: 'Q', faceUp: false }, null, null]))).toEqual([false, true, false, false]);
  });

  it('a face-up number card threatens the slot in front; Ace and Joker threaten nothing', () => {
    expect(threatsFrom(rival([{ rank: '7', faceUp: true }, null, { rank: 'A', faceUp: true }, { rank: 'JOKER', faceUp: true }])))
      .toEqual([true, false, false, false]);
  });
});
