import { describe, expect, it } from 'vitest';
import { BoardSlot, Rank } from '@/types';
import { createEmptyBoard, RANKS } from '@/lib/game-utils';
import { deckSummary, forecastFight, threatsFrom } from './forecast';

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

const mine = (ranks: (Rank | null)[]): BoardSlot[] =>
  createEmptyBoard().map((slot, i) => {
    const r = ranks[i];
    return { ...slot, card: r ? { id: `p-${i}`, rank: r, owner: 'player', suit: 'standard', value: RANKS[r].value, isFaceUp: true } : null };
  });

describe('forecastFight', () => {
  it('counts sure hits on empty slots and hides nothing about face-down cards', () => {
    const f = forecastFight(mine(['K', null, '5', null]), rival([null, { rank: '9', faceUp: false }, null, null]));
    // El Rey en 0 golpea 0 y 1: 0 vacío (seguro), 1 ocupado. El 5 golpea el 2 vacío.
    expect(f.dealt).toEqual({ sure: 2, maybe: 0 });
    // La carta oculta del rival podría golpear tu hueco 1 (vacío)
    expect(f.taken).toEqual({ sure: 0, maybe: 1 });
  });

  it('the Jack counts as a possible hit and the Ace cancels everything', () => {
    expect(forecastFight(mine([null, 'J', null, null]), rival([null, null, null, null])).dealt).toEqual({ sure: 0, maybe: 1 });
    expect(forecastFight(mine(['A', '5', null, null]), rival([null, null, null, null])).dealt).toEqual({ sure: 0, maybe: 0 });
  });
});

describe('deckSummary', () => {
  it('groups remaining cards by rank in deck order', () => {
    const summary = deckSummary(mine(['K', 'K', '5', null]).flatMap(s => (s.card ? [s.card] : [])));
    expect(summary.find(r => r.rank === 'K')?.count).toBe(2);
    expect(summary.find(r => r.rank === '5')?.count).toBe(1);
    expect(summary.find(r => r.rank === 'A')?.count).toBe(0);
  });
});
