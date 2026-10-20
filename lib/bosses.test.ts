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
  beforeEach(() => store.clear());

  it('el primero no tiene sello y desbloquea la colección; el resto, su sello', async () => {
    const b = await load();
    expect(b.currentBossIndex()).toBe(0);
    expect(b.isCollectionUnlocked()).toBe(false);
    expect(b.recordBossDefeat(0)).toEqual([{ kind: 'collection' }]);
    expect(b.isCollectionUnlocked()).toBe(true);
    expect(b.unlockedSeals()).toEqual([]);
    expect(b.recordBossDefeat(1)).toEqual([{ kind: 'seal', seal: 'shield' }]);
    expect(b.unlockedSeals()).toEqual(['shield']);
    expect(b.currentBossIndex()).toBe(2);
  });

  it('volver a ganar a un boss ya vencido no desbloquea nada; el último se repite', async () => {
    const b = await load();
    b.BOSSES.forEach((_, i) => b.recordBossDefeat(i));
    expect(b.recordBossDefeat(b.BOSSES.length - 1)).toEqual([]);
    expect(b.currentBossIndex()).toBe(b.BOSSES.length - 1);
    expect(b.unlockedSeals()).toEqual(['shield', 'double', 'shift', 'swap', 'life']);
  });

  it('tu mazo lleva una carta por sello y el del boss dos copias del suyo', async () => {
    const b = await load();
    expect(b.buildPlayerDeck(['shield', 'life']).filter(c => c.rank === 'SEAL').map(c => c.seal).sort()).toEqual(['life', 'shield']);
    const boss = b.BOSSES[1];
    expect(b.buildBossDeck(boss).filter(c => c.seal === 'shield')).toHaveLength(2);
    expect(b.buildBossDeck(b.BOSSES[0]).some(c => c.rank === 'SEAL')).toBe(false);
  });
});
