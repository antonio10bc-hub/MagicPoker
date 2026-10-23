import { describe, expect, it } from 'vitest';
import { Card, CombatResult } from '@/types';
import { endStamps, MatchEnd, newMatchTrack, roundStamps } from '@/lib/stamps';

const combat = (over: Partial<CombatResult>): CombatResult => ({
  playerDamageTaken: 0, opponentDamageTaken: 0, deadCardIds: [], voidedCardIds: [],
  playerEmptySlotsHit: {}, opponentEmptySlotsHit: {}, damageSources: {}, cardsDestroyedCount: 0,
  deadByOwner: { player: 0, opponent: 0 }, shieldedIds: [], shieldHits: {}, reflected: [], poisonedIds: [],
  isRepublicanaTriggered: false, ...over,
});

const end = (over: Partial<MatchEnd>): MatchEnd => ({
  result: 'win', finalBoss: false, rounds: 5, livesLeft: 2, startingLives: 4, streak: 1, totalGames: 3,
  track: newMatchTrack(), ...over,
});

describe('roundStamps', () => {
  it('massacre needs 3 rival cards destroyed, not yours', () => {
    expect(roundStamps(combat({ cardsDestroyedCount: 3, deadByOwner: { player: 0, opponent: 3 } }))).toContain('massacre');
    expect(roundStamps(combat({ cardsDestroyedCount: 3, deadByOwner: { player: 2, opponent: 1 } }))).not.toContain('massacre');
  });

  it('barrage and republicana', () => {
    expect(roundStamps(combat({ opponentDamageTaken: 3, isRepublicanaTriggered: true }))).toEqual(['republicana', 'barrage']);
  });
});

describe('endStamps', () => {
  it('a flawless fast win on hard earns several stamps', () => {
    const got = endStamps(end({ livesLeft: 4, rounds: 3, finalBoss: true, streak: 3 }));
    expect(got).toEqual(expect.arrayContaining(['first_win', 'flawless', 'lightning', 'hard_win', 'streak3']));
    expect(got).not.toContain('comeback');
  });

  it('a loss earns no win stamps; full court counts any result', () => {
    const track = { ranksPlayed: ['J', 'Q', 'K', 'A', 'JOKER', '5'] as const } as unknown as ReturnType<typeof newMatchTrack>;
    expect(endStamps(end({ result: 'loss', track }))).toEqual(['full_court']);
  });

  it('draw and veteran', () => {
    expect(endStamps(end({ result: 'draw', totalGames: 25 }))).toEqual(['stalemate', 'veteran']);
  });
});

describe('logros de sellos', () => {
  it('muralla, reflejo y veneno de reyes al resolver la pelea', () => {
    const mine = new Set(['p1', 'p2', 'p3']);
    const cards = new Map([['o1', { id: 'o1', rank: 'K' }], ['o2', { id: 'o2', rank: '5' }]]) as unknown as Map<string, Card>;
    expect(roundStamps(combat({ shieldHits: { p1: 3 } }), mine)).toContain('bulwark');
    expect(roundStamps(combat({ shieldHits: { p1: 2, o9: 4 } }), mine)).not.toContain('bulwark');
    expect(roundStamps(combat({ reflected: [{ mirrorId: 'p2', attackerId: 'o2' }] }), mine)).toContain('reflex');
    expect(roundStamps(combat({ poisonedIds: ['o1'] }), mine, cards)).toContain('venom');
    expect(roundStamps(combat({ poisonedIds: ['o2'] }), mine, cards)).not.toContain('venom');
  });

  it('revancha y purista al ganar', () => {
    const track = { ...newMatchTrack(), sealsPlayed: 0 };
    expect(endStamps(end({ rematch: true, track }))).toContain('rematch');
    expect(endStamps(end({ sealsInDeck: 2, track }))).toContain('purist');
    expect(endStamps(end({ sealsInDeck: 2, track: { ...track, sealsPlayed: 1 } }))).not.toContain('purist');
    expect(endStamps(end({ sealsInDeck: 0, track }))).not.toContain('purist');
  });
});

describe('inmolación', () => {
  const mine = new Set(['a', 'j', 'q', 'k']);
  const cards = new Map(['A', 'J', 'Q', 'K'].map(r => [r.toLowerCase(), { id: r.toLowerCase(), rank: r }])) as unknown as Map<string, Card>;
  it('tu As se lleva tu propio J, Q y K', () => {
    expect(roundStamps(combat({ voidedCardIds: ['a', 'j', 'q', 'k'] }), mine, cards)).toContain('immolation');
  });
  it('sin As tuyo o sin la corte entera, no cuenta', () => {
    expect(roundStamps(combat({ voidedCardIds: ['j', 'q', 'k'] }), new Set(['j', 'q', 'k']), cards)).not.toContain('immolation');
    expect(roundStamps(combat({ voidedCardIds: ['a', 'q', 'k'] }), new Set(['a', 'q', 'k']), cards)).not.toContain('immolation');
    expect(roundStamps(combat({}), mine, cards)).not.toContain('immolation');
  });
});
