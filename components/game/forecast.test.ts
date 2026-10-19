import { describe, expect, it } from 'vitest';
import { BoardSlot, Rank } from '@/types';
import { createEmptyBoard, RANKS } from '@/lib/game-utils';
import { aimAtOpponent, collectAttacks, deckSummary, facingOutcomes, forecastFight, threatsFrom } from './forecast';

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

describe('arrows (facingOutcomes)', () => {
  it('a face-to-face loser is marked losing; the winner is not', () => {
    const { attacks } = collectAttacks(mine([null, '10', null, null]), rival([null, { rank: '8', faceUp: true }, null, null]), null);
    const { losing, clashing } = facingOutcomes(attacks);
    expect([...losing].map(a => a.card.rank)).toEqual(['8']);
    expect(clashing.size).toBe(0);
  });

  it('equal values clash; the Jack (random) never counts as face to face', () => {
    const tie = collectAttacks(mine(['7', null, null, null]), rival([{ rank: '7', faceUp: true }, null, null, null]), null);
    expect(facingOutcomes(tie.attacks).clashing.size).toBe(2);
    const jack = collectAttacks(mine(['J', null, null, null]), rival([{ rank: 'K', faceUp: true }, null, null, null]), null);
    expect(facingOutcomes(jack.attacks).losing.size).toBe(0);
  });

  it('face-down rival cards draw no arrows; the Ace is a wiper, not an arrow', () => {
    const r = collectAttacks(mine(['A', null, null, null]), rival([null, { rank: 'K', faceUp: false }, null, null]), null);
    expect(r.attacks).toHaveLength(0);
    expect(r.wipers).toEqual([{ index: 0, owner: 'player' }]);
  });

  it('the Queen preview aims only at the diagonals', () => {
    const q = mine(['Q', null, null, null])[0].card!;
    const r = collectAttacks(mine([null, null, null, null]), rival([null, null, null, null]), { card: q, slotIndex: 1 });
    expect(r.attacks.map(a => a.target).sort()).toEqual([0, 2]);
    expect(r.attacks.every(a => a.preview)).toBe(true);
  });
});

describe('aimAtOpponent ("-N" on empty rival slots)', () => {
  it('only counts cards with arrows on, plus the preview', () => {
    const b = mine(['K', '5', null, null]);
    expect(aimAtOpponent(b, null, new Set()).every(a => a.sure === 0)).toBe(true);
    const aims = aimAtOpponent(b, null, new Set([b[0].card!.id, b[1].card!.id]));
    // Rey en 0 → huecos 0 y 1; el 5 en 1 → hueco 1
    expect(aims.map(a => a.sure)).toEqual([1, 2, 0, 0]);
  });
});
