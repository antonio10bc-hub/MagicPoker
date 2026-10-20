import { beforeEach, describe, expect, it, vi } from 'vitest';

// localStorage mínimo para el progreso
const store = new Map<string, string>();
vi.stubGlobal('window', {});
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
});

const load = async () => {
  vi.resetModules();
  return import('@/lib/bosses');
};

describe('progresión de bosses', () => {
  it('el jefe secreto aparece al vencer al último normal', async () => {
    const b = await load();
    const secret = b.BOSSES.length - 1;
    expect(b.isBossVisible(secret)).toBe(false);
    for (let i = 0; i < secret - 1; i++) b.recordBossDefeat(i);
    expect(b.recordBossDefeat(secret - 1)).toEqual([{ kind: 'seal', seal: 'reveal' }, { kind: 'secret' }]);
    expect(b.isBossVisible(secret)).toBe(true);
    expect(b.recordBossDefeat(secret)).toEqual([{ kind: 'castle' }]);
    expect(b.isCastleUnlocked()).toBe(true);
  });

  it('revancha: una vida más y un segundo sello; el secreto lleva todos', async () => {
    const b = await load();
    const wall = b.BOSSES[1];
    // Nivel 1: +1 vida y un segundo sello
    expect(b.bossLives(wall, 1)).toBe(wall.lives + 1);
    expect(b.bossSeals(wall, 1)).toEqual(['shield', 'shield', 'double', 'double']);
    // Nivel 2: una copia más de cada · 3: +2 vidas · 4: un tercer sello
    expect(b.bossSeals(wall, 2)).toHaveLength(6);
    expect(b.bossLives(wall, 3)).toBe(wall.lives + 2);
    expect(new Set(b.bossSeals(wall, 4))).toEqual(new Set(['shield', 'double', 'shift']));
    expect(b.bossSeals(b.BOSSES[0], 1)).toEqual(['shield', 'shield']);
    expect(new Set(b.bossSeals(b.BOSSES[b.BOSSES.length - 1]))).toEqual(new Set(b.ALL_SEALS));
  });

  it('cada revancha ganada sube el nivel y la quinta victoria da el dorso', async () => {
    const b = await load();
    b.recordBossDefeat(0);
    b.recordBossDefeat(1);
    expect(b.bossWins(1)).toBe(1);
    expect(b.rematchLevel(1)).toBe(1);
    expect(b.recordRematchWin(1)).toEqual([]);
    expect(b.rematchLevel(1)).toBe(2);
    b.recordRematchWin(1);
    b.recordRematchWin(1);
    expect(b.rematchLevel(1)).toBe(4);
    expect(b.recordRematchWin(1)).toEqual([{ kind: 'back', boss: 'wall' }]);
    expect(b.unlockedBacks()).toEqual(['wall']);
    expect(b.rematchLevel(1)).toBe(4);
    // Sin vencerlo antes no hay revancha que contar
    expect(b.recordRematchWin(5)).toEqual([]);
  });

  beforeEach(() => store.clear());

  it('el primero no tiene sello y desbloquea la colección; el resto, su sello', async () => {
    const b = await load();
    expect(b.currentBossIndex()).toBe(0);
    expect(b.isCollectionUnlocked()).toBe(false);
    expect(b.recordBossDefeat(0)).toEqual([{ kind: 'collection' }]);
    expect(b.isCollectionUnlocked()).toBe(true);
    expect(b.unlockedSeals()).toEqual([]);
    expect(b.isEditorUnlocked()).toBe(false);
    // Con el primer sello llega el editor de mazo
    expect(b.recordBossDefeat(1)).toEqual([{ kind: 'seal', seal: 'shield' }, { kind: 'editor' }]);
    expect(b.isEditorUnlocked()).toBe(true);
    expect(b.unlockedSeals()).toEqual(['shield']);
    expect(b.currentBossIndex()).toBe(2);
  });

  it('volver a ganar a un boss ya vencido no desbloquea nada; el último se repite', async () => {
    const b = await load();
    b.BOSSES.forEach((_, i) => b.recordBossDefeat(i));
    expect(b.recordBossDefeat(b.BOSSES.length - 1)).toEqual([]);
    expect(b.currentBossIndex()).toBe(b.BOSSES.length - 1);
    expect(b.unlockedSeals()).toEqual(['shield', 'double', 'shift', 'swap', 'life', 'mirror', 'poison', 'echo', 'anchor', 'reveal']);
    expect(b.isEditorUnlocked()).toBe(true);
  });

  it('tu mazo lleva una carta por sello y el del boss dos copias del suyo', async () => {
    const b = await load();
    expect(b.buildPlayerDeck(['shield', 'life']).filter(c => c.rank === 'SEAL').map(c => c.seal).sort()).toEqual(['life', 'shield']);
    const boss = b.BOSSES[1];
    expect(b.buildBossDeck(boss).filter(c => c.seal === 'shield')).toHaveLength(2);
    expect(b.buildBossDeck(b.BOSSES[0]).some(c => c.rank === 'SEAL')).toBe(false);
  });
});
