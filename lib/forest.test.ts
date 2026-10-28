import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('window', {});
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
});

const { ARCHETYPES, bestiaryComplete, buildForestDeck, FOREST_LIVES, forestDeckConfig, forestAi, getForest, isForestUnlocked, recordForestDuel, rollEncounter, TIER_WEIGHTS } = await import('@/lib/forest');
const { createDeck } = await import('@/lib/game-utils');

describe('el Bosque', () => {
  beforeEach(() => store.clear());

  it('se abre al conquistar el Castillo', () => {
    expect(isForestUnlocked({ best: 12, conquered: 0 } as never)).toBe(false);
    expect(isForestUnlocked({ best: 12, conquered: 1 } as never)).toBe(true);
  });

  it('el sorteo respeta 52/28/10/5/5 y saca a alguien de ese nivel', () => {
    let seed = 1;
    const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const n = 20000;
    const count = { normal: 0, hard: 0, nightmare: 0, unique: 0, renegade: 0 };
    for (let i = 0; i < n; i++) {
      const e = rollEncounter(rng);
      expect(ARCHETYPES.find(a => a.id === e.id)?.tier).toBe(e.tier);
      count[e.tier]++;
    }
    (Object.keys(count) as (keyof typeof count)[]).forEach(t => expect(Math.abs(count[t] / n * 100 - TIER_WEIGHTS[t])).toBeLessThan(1.5));
  });

  it('cuatro por nivel y tres únicos', () => {
    expect(['normal', 'hard', 'nightmare'].map(t => ARCHETYPES.filter(a => a.tier === t).length)).toEqual([4, 4, 4]);
    expect(ARCHETYPES.filter(a => a.tier === 'unique').map(a => a.id)).toEqual(['prince', 'queen', 'king']);
    expect(ARCHETYPES.filter(a => a.tier === 'renegade').map(a => a.id)).toEqual(['anchorite']);
  });

  it('el Anacoreta: el mazo estándar entero más robo, 2 vidas, espejo y eco; tan duro como una pesadilla', () => {
    const a = ARCHETYPES.find(x => x.id === 'anchorite')!;
    const deck = buildForestDeck(a);
    const std = createDeck('opponent');
    expect(deck.filter(c => c.rank !== 'SEAL').map(c => c.rank).sort()).toEqual(std.map(c => c.rank).sort());
    const seals = deck.filter(c => c.rank === 'SEAL').reduce<Record<string, number>>((m, c) => ({ ...m, [c.seal!]: (m[c.seal!] ?? 0) + 1 }), {});
    expect(seals).toEqual({ swap: 1, life: 2, mirror: 1, echo: 1 });
    expect(forestDeckConfig(a)).toEqual({ seals: { swap: 1, life: 2, mirror: 1, echo: 1 }, removed: [] });
    expect(FOREST_LIVES.renegade).toBe(FOREST_LIVES.nightmare);
    expect(forestAi('renegade')).toBe('hard');
    expect(TIER_WEIGHTS.renegade).toBe(TIER_WEIGHTS.unique);
  });

  it('los únicos llevan su figura tres veces en vez de Príncipe, Reina y Rey', () => {
    const queen = buildForestDeck(ARCHETYPES.find(a => a.id === 'queen')!);
    expect(queen.filter(c => c.rank === 'Q')).toHaveLength(3);
    expect(queen.filter(c => c.rank === 'J' || c.rank === 'K')).toHaveLength(0);
    const king = buildForestDeck(ARCHETYPES.find(a => a.id === 'king')!);
    expect(king.filter(c => c.rank === 'K')).toHaveLength(3);
  });

  it('el nivel endurece el mazo: más sellos y cartas del Castillo', () => {
    const witch = ARCHETYPES.find(a => a.id === 'witch')!;
    const seals = (t: 'normal' | 'hard' | 'nightmare') => buildForestDeck(witch, t).filter(c => c.rank === 'SEAL').length;
    const spies = (t: 'normal' | 'hard' | 'nightmare') => buildForestDeck(witch, t).filter(c => c.rank === 'SPY').length;
    expect([seals('normal'), seals('hard'), seals('nightmare')]).toEqual([2, 4, 6]);
    expect([spies('normal'), spies('hard'), spies('nightmare')]).toEqual([0, 1, 2]);
    expect(buildForestDeck(witch, 'hard').every(c => c.owner === 'opponent')).toBe(true);
    expect(forestAi('normal')).toBe('normal');
    expect(forestAi('nightmare')).toBe('hard');
  });

  it('su mazo para copiar: sus sellos a 2 copias, sin pasar de 5', () => {
    expect(forestDeckConfig(ARCHETYPES.find(a => a.id === 'witch')!)).toEqual({ seals: { poison: 2, mirror: 2 }, removed: [] });
    expect(forestDeckConfig(ARCHETYPES.find(a => a.id === 'goblin')!)).toEqual({ seals: { shift: 2, echo: 2, swap: 1 }, removed: [] });
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
