import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('window', {});
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
});

const { ARCHETYPES, bestiaryComplete, buildForestDeck, forestAi, getForest, isForestUnlocked, recordForestDuel, rollEncounter, TIER_WEIGHTS } = await import('@/lib/forest');

describe('el Bosque', () => {
  beforeEach(() => store.clear());

  it('se abre al conquistar el Castillo', () => {
    expect(isForestUnlocked({ best: 12, conquered: 0 } as never)).toBe(false);
    expect(isForestUnlocked({ best: 12, conquered: 1 } as never)).toBe(true);
  });

  it('el sorteo respeta 60/30/10 y elige un arquetipo que existe', () => {
    let seed = 1;
    const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const n = 20000;
    const count = { normal: 0, hard: 0, nightmare: 0 };
    for (let i = 0; i < n; i++) {
      const e = rollEncounter(rng);
      expect(ARCHETYPES.some(a => a.id === e.id)).toBe(true);
      count[e.tier]++;
    }
    (Object.keys(count) as (keyof typeof count)[]).forEach(t => expect(Math.abs(count[t] / n * 100 - TIER_WEIGHTS[t])).toBeLessThan(1.5));
  });

  it('la dificultad endurece el mazo: más sellos y cartas del Castillo', () => {
    const witch = ARCHETYPES.find(a => a.id === 'witch')!;
    const seals = (t: 'normal' | 'hard' | 'nightmare') => buildForestDeck(witch, t).filter(c => c.rank === 'SEAL').length;
    const spies = (t: 'normal' | 'hard' | 'nightmare') => buildForestDeck(witch, t).filter(c => c.rank === 'SPY').length;
    expect([seals('normal'), seals('hard'), seals('nightmare')]).toEqual([2, 4, 6]);
    expect([spies('normal'), spies('hard'), spies('nightmare')]).toEqual([0, 1, 2]);
    expect(buildForestDeck(witch, 'hard').every(c => c.owner === 'opponent')).toBe(true);
    expect(forestAi('normal')).toBe('normal');
    expect(forestAi('nightmare')).toBe('hard');
  });

  it('bestiario y racha', () => {
    recordForestDuel({ id: 'witch', tier: 'nightmare' }, 'win');
    recordForestDuel({ id: 'witch', tier: 'nightmare' }, 'win');
    recordForestDuel({ id: 'bandit', tier: 'normal' }, 'draw');
    let f = getForest();
    expect(f.seen.witch?.nightmare).toEqual({ wins: 2, losses: 0 });
    expect(f.streak).toBe(2);
    f = recordForestDuel({ id: 'bandit', tier: 'normal' }, 'loss');
    expect(f.streak).toBe(0);
    expect(f.bestStreak).toBe(2);
    expect(f.duels).toBe(4);
    expect(bestiaryComplete(f)).toBe(false);
    ARCHETYPES.forEach(a => recordForestDuel({ id: a.id, tier: 'normal' }, 'win'));
    expect(bestiaryComplete()).toBe(true);
  });
});
