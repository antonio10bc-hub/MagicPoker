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

  it('rarezas: legendarias solo arriba y con su rareza', async () => {
    const c = await load();
    const run = c.ensureRun();
    expect(c.boonRarity({ kind: 'heal' })).toBe('common');
    expect(c.boonRarity({ kind: 'seal', seal: 'shield', target: 0 })).toBe('rare');
    expect(c.boonRarity({ kind: 'card', rank: 'DRAGON' })).toBe('legendary');
    // Abajo nunca sale una legendaria
    expect(c.offerBoons(run, fixed(0)).some(b => c.boonRarity(b) === 'legendary')).toBe(false);
    // Arriba, con suerte, sí (y las 3 siguen siendo de tipos distintos)
    const high = c.offerBoons({ ...run, stage: 8 }, fixed(0));
    expect(high.some(b => c.boonRarity(b) === 'legendary')).toBe(true);
    expect(new Set(high.map(b => b.kind)).size).toBe(3);
  });

  it('cofre: cada 3 pisos, con un premio válido que se aplica al abrirlo', async () => {
    const c = await load();
    expect([1, 2, 3, 4, 6, 9, 11].map(c.isChestFloor)).toEqual([false, false, true, false, true, true, false]);
    const run = c.ensureRun();
    for (const n of [0, 0.2, 0.5, 0.7, 0.99]) {
      const boon = c.rollChest(run, fixed(n));
      expect(boon.kind).not.toBe('pact');
    }
    expect(c.boonRarity(c.rollChest(run, fixed(0)))).toBe('legendary');
    // Se gana el piso 3: hay cofre; al abrirlo se aplica y desaparece
    c.recordCastleWin(4);
    c.recordCastleWin(4);
    const out = c.recordCastleWin(4);
    expect(out.kind === 'next' && out.run.chest).toBeTruthy();
    const deckBefore = c.getCastle().run!.deck.length;
    const livesBefore = c.getCastle().run!.maxLives;
    const prize = c.openChest()!;
    const after = c.getCastle().run!;
    expect(after.chest).toBeUndefined();
    expect(after.offer).toHaveLength(3);
    expect(after.deck.length + after.maxLives).toBeGreaterThanOrEqual(deckBefore + livesBefore - (prize.kind === 'purge' ? 2 : 0));
  });

  it('desafíos: cambian el arranque, los jefes y lo que se ofrece', async () => {
    const c = await load();
    const run = c.ensureRun(['fragile', 'short', 'noHeal', 'fierce', 'sealed']);
    expect(run).toMatchObject({ lives: 3, maxLives: 3 });
    expect(run.deck.some(card => card.rank === '2')).toBe(false);
    expect(run.deck.filter(card => card.rank !== 'SEAL')).toHaveLength(10);
    const plain = { ...run, challenges: undefined };
    expect(c.castleBossLives(run)).toBe(c.castleBossLives(plain) + 1);
    expect(c.castleBossLevel(0, run)).toBe(c.castleBossLevel(0) + 1);
    // Con vida por perder, sin desafío saldría curarte; con "sin curas", nunca
    for (const n of [0, 0.3, 0.6, 0.99]) expect(c.offerBoons({ ...run, lives: 1 }, fixed(n)).some(b => b.kind === 'heal')).toBe(false);
    expect(c.getCastle().lastChallenges).toHaveLength(5);
  });

  it('dorsos del Castillo: conquistarlo, una legendaria y los 5 desafíos', async () => {
    const c = await load();
    expect(c.castleBacks({ run: null, best: 0, conquered: 0 })).toEqual([]);
    expect(c.castleBacks({ run: null, best: 12, conquered: 1, bestChallenges: 2 })).toEqual(['castle']);
    expect(c.castleBacks({ run: null, best: 12, conquered: 1, bestChallenges: 5, legendary: true })).toEqual(['castle', 'merchant', 'crown']);
    // Elegir una legendaria la marca
    const run = c.ensureRun();
    localStorage.setItem('magic_poker_castle', JSON.stringify({ ...c.getCastle(), run: { ...run, offer: [{ kind: 'card', rank: 'PHOENIX' }] } }));
    const fresh = await load();
    fresh.chooseBoon(0);
    expect(fresh.getCastle().legendary).toBe(true);
    expect(fresh.castleBacks()).toContain('merchant');
  });
});
