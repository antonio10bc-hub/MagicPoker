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
    expect(c.recordCastleWin(4)).toEqual({ kind: 'conquered', challenges: [] });
    expect(c.getCastle()).toMatchObject({ run: null, best: c.CASTLE_LENGTH, conquered: 1 });
  });

  it('al conquistarlo dice con qué desafíos (para darte el logro de cada uno)', async () => {
    const c = await load();
    c.ensureRun(['fierce', 'noHeal']);
    for (let i = 0; i < c.CASTLE_LENGTH - 1; i++) c.recordCastleWin(4);
    expect(c.recordCastleWin(4)).toEqual({ kind: 'conquered', challenges: ['noHeal', 'fierce'] });
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
    // Mazo corto: sin las 2 más flojas (el Joker, que vale 0, y el 2)
    expect(run.deck.some(card => card.rank === 'JOKER')).toBe(false);
    expect(run.deck.filter(card => card.rank !== 'SEAL')).toHaveLength(12);
    const plain = { ...run, challenges: undefined };
    // Jefes feroces: la IA difícil desde el primer piso; jefes sellados: dos niveles más
    expect(c.castleAi(0, run)).toBe('hard');
    expect(c.castleBossLives(run)).toBe(c.castleBossLives(plain));
    expect(c.castleBossLevel(0, run)).toBe(c.castleBossLevel(0) + 2);
    // Con vida por perder, sin desafío saldría curarte; con "sin curas", nunca
    for (const n of [0, 0.3, 0.6, 0.99]) expect(c.offerBoons({ ...run, lives: 1 }, fixed(n)).some(b => b.kind === 'heal')).toBe(false);
    expect(c.getCastle().lastChallenges).toHaveLength(5);
  });

  it('dorsos del Castillo: conquistarlo, una legendaria y los 5 desafíos', async () => {
    const c = await load();
    expect(c.castleBacks({ run: null, best: 0, conquered: 0 })).toEqual([]);
    expect(c.castleBacks({ run: null, best: 12, conquered: 1, bestChallenges: 2 })).toEqual(['castle']);
    expect(c.castleBacks({ run: null, best: 12, conquered: 1, bestChallenges: 6, legendary: true })).toEqual(['castle', 'merchant', 'crown']);
    // Elegir una legendaria la marca
    const run = c.ensureRun();
    localStorage.setItem('magic_poker_castle', JSON.stringify({ ...c.getCastle(), run: { ...run, offer: [{ kind: 'card', rank: 'PHOENIX' }] } }));
    const fresh = await load();
    fresh.chooseBoon(0);
    expect(fresh.getCastle().legendary).toBe(true);
    expect(fresh.castleBacks()).toContain('merchant');
  });

  it('estadísticas de la subida y resumen al terminarla', async () => {
    const c = await load();
    c.ensureRun(['fragile']);
    c.trackCastleFight({ dealt: 2, lost: 1, destroyed: 2, cardsLost: 1 });
    c.trackCastleFight({ dealt: 3, lost: 0, destroyed: 1, cardsLost: 0 });
    c.recordCastleWin(2, fixed(0));
    c.chooseBoon(0);
    const stats = c.getCastle().run!.stats!;
    expect(stats).toMatchObject({ rounds: 2, damageDealt: 5, livesLost: 1, cardsDestroyed: 3, cardsLost: 1, bestHit: 3 });
    expect(stats.boons.common + stats.boons.rare + stats.boons.legendary).toBe(1);
    // Cae en el piso 2: queda el resumen con su mazo
    c.recordCastleLoss();
    const sum = c.getCastle().lastSummary!;
    expect(sum).toMatchObject({ outcome: 'fallen', floors: 1, challenges: ['fragile'] });
    expect(sum.deck.length).toBeGreaterThan(0);
    expect(sum.stats.rounds).toBe(2);
  });
});

describe('el Castillo: puntos de guardado (pisos 4 y 8) e IA de cada piso', () => {
  beforeEach(() => store.clear());

  /** Sube hasta el piso `to` (índice) eligiendo siempre la primera mejora y abriendo cofres */
  const climb = (c: Awaited<ReturnType<typeof load>>, to: number) => {
    while (c.getCastle().run!.stage < to) {
      c.recordCastleWin(3, fixed(0.5));
      if (c.getCastle().run!.chest) c.openChest();
      c.chooseBoon(0);
    }
  };

  it('al llegar al piso 4 queda guardado; si caes, lo retomas con las vidas llenas', async () => {
    const c = await load();
    c.ensureRun();
    climb(c, 2);
    expect(c.getCastle().checkpoint).toBeUndefined();
    climb(c, 3);
    expect(c.getCastle().checkpoint).toMatchObject({ stage: 3 });
    climb(c, 5);
    const out = c.recordCastleLoss();
    expect(out).toMatchObject({ kind: 'fallen', stage: 5, checkpoint: 3 });
    expect(c.getCastle().run).toBeNull();
    const run = c.resumeCheckpoint()!;
    expect(run).toMatchObject({ stage: 3, lives: run.maxLives });
    expect(run.offer).toBeUndefined();
    // Sigue guardado: si vuelves a caer, vuelves al mismo sitio
    c.recordCastleLoss();
    expect(c.getCastle().checkpoint).toMatchObject({ stage: 3 });
  });

  it('el siguiente punto sustituye al anterior; empezar de cero o conquistarlo lo borra', async () => {
    const c = await load();
    c.ensureRun();
    climb(c, 7);
    expect(c.getCastle().checkpoint).toMatchObject({ stage: 7 });
    c.recordCastleLoss();
    c.ensureRun();
    expect(c.getCastle().checkpoint).toBeUndefined();
  });

  it('con «Sin caer» no hay puntos de guardado', async () => {
    const c = await load();
    c.ensureRun(['noDeath']);
    climb(c, 4);
    expect(c.getCastle().checkpoint).toBeUndefined();
    expect(c.recordCastleLoss()).toEqual({ kind: 'fallen', stage: 4 });
  });

  it('los 6 primeros pisos, la IA normal; luego la difícil; con «Jefes feroces», siempre la difícil', async () => {
    const c = await load();
    expect([0, 5, 6, 11].map(s => c.castleAi(s))).toEqual(['normal', 'normal', 'hard', 'hard']);
    const fierce = c.ensureRun(['fierce']);
    expect(c.castleAi(0, fierce)).toBe('hard');
  });
});
