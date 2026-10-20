import { describe, expect, it } from 'vitest';
import { CombatResult } from '@/types';
import { endStamps, MatchEnd, newMatchTrack, roundStamps } from '@/lib/stamps';

const combat = (over: Partial<CombatResult>): CombatResult => ({
  playerDamageTaken: 0, opponentDamageTaken: 0, deadCardIds: [], voidedCardIds: [],
  playerEmptySlotsHit: {}, opponentEmptySlotsHit: {}, damageSources: {}, cardsDestroyedCount: 0,
  deadByOwner: { player: 0, opponent: 0 }, shieldedIds: [],
  isRepublicanaTriggered: false, ...over,
});

const end = (over: Partial<MatchEnd>): MatchEnd => ({
  result: 'win', difficulty: 'normal', rounds: 5, livesLeft: 2, startingLives: 4, streak: 1, totalGames: 3,
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
    const got = endStamps(end({ livesLeft: 4, rounds: 3, difficulty: 'hard', streak: 3 }));
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
