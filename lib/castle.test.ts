import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('window', {});
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
});

const load = async () => {
  vi.resetModules();
  return import('@/lib/castle');
};
/** Azar fijo: siempre el mismo número */
const fixed = (n: number) => () => n;

describe('el Castillo', () => {
  beforeEach(() => store.clear());

  it('empieza con tu mazo, 4 vidas, en el primer jefe; las vidas se arrastran', async () => {
    const c = await load();
    const run = c.ensureRun();
    expect(run).toMatchObject({ stage: 0, lives: 4, maxLives: 4 });
    expect(run.deck.length).toBeGreaterThanOrEqual(14);
    const out = c.recordCastleWin(2, fixed(0));
    expect(out.kind).toBe('next');
    expect(c.getCastle().run).toMatchObject({ stage: 1, lives: 2 });
    expect(c.getCastle().run!.offer).toHaveLength(3);
  });

  it('las mejoras se aplican: curar, carta nueva, sello permanente, mejora, purga, vida máxima y pacto', async () => {
    const c = await load();
    const run = { ...c.ensureRun(), lives: 2 };
    expect(c.applyBoon(run, { kind: 'heal' }).lives).toBe(4);
    expect(c.applyBoon(run, { kind: 'card', rank: 'TOWER' }).deck.at(-1)).toEqual({ rank: 'TOWER', merchant: true });
    expect(c.applyBoon(run, { kind: 'card', rank: 'WILD' }).deck.at(-1)).toEqual({ rank: 'SEAL', wild: true, merchant: true });
    expect(c.applyBoon(run, { kind: 'seal', seal: 'mirror', target: 0 }).deck[0].seal).toBe('mirror');
    expect(c.applyBoon(run, { kind: 'upgrade', target: 0 }).deck[0].bonus).toBe(2);
    expect(c.applyBoon(run, { kind: 'purge', targets: [0, 1] }).deck).toHaveLength(run.deck.length - 2);
    // Lo que toca el mercader queda marcado, también en las cartas de la pelea
    expect(c.applyBoon(run, { kind: 'upgrade', target: 0 }).deck[0].merchant).toBe(true);
    const bought = c.applyBoon(run, { kind: 'card', rank: 'KNIGHT' });
    expect(c.buildRunDeck(bought).filter(card => card.merchant).map(card => card.rank)).toEqual(['KNIGHT']);
    expect(c.applyBoon(run, { kind: 'maxLife' })).toMatchObject({ maxLives: 5, lives: 3 });
    const pact = c.applyBoon(run, { kind: 'pact' });
    expect(pact).toMatchObject({ pact: true, lives: 1 });
    expect(c.castleBossLives(pact)).toBe(c.castleBossLives(run) - 1);
  });

  it('la bolsa: tres mejoras distintas y válidas (con vidas llenas no ofrece curar)', async () => {
    const c = await load();
    const run = c.ensureRun();
    for (const n of [0, 0.3, 0.6, 0.99]) {
      const offer = c.offerBoons(run, fixed(n));
      expect(offer).toHaveLength(3);
      expect(new Set(offer.map(b => b.kind)).size).toBe(3);
      expect(offer.some(b => b.kind === 'heal')).toBe(false);
    }
  });

  it('el mazo de la pelea respeta sellos permanentes, mejoras y comodines', async () => {
    const c = await load();
    const run = { ...c.ensureRun(), deck: [{ rank: '5' as const, seal: 'shield' as const, bonus: 2 }, { rank: 'SEAL' as const, wild: true }] };
    const deck = c.buildRunDeck(run);
    expect(deck.find(x => x.rank === '5')).toMatchObject({ seal: 'shield', value: 7 });
    expect(deck.find(x => x.rank === 'SEAL')).toMatchObject({ wild: true });
  });

  it('al caer se acaba la subida y se guarda el récord; al vencer al último, conquistado', async () => {
    const c = await load();
    c.ensureRun();
    c.recordCastleWin(4);
    c.recordCastleWin(4);
    expect(c.recordCastleLoss()).toEqual({ kind: 'fallen', stage: 2 });
    expect(c.getCastle()).toMatchObject({ run: null, best: 2 });
    c.ensureRun();
    for (let i = 0; i < c.CASTLE_LENGTH - 1; i++) c.recordCastleWin(4);
    expect(c.recordCastleWin(4)).toEqual({ kind: 'conquered' });
    expect(c.getCastle()).toMatchObject({ run: null, best: c.CASTLE_LENGTH, conquered: 1 });
  });
});
