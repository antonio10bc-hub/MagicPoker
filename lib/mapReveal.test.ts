import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
});

const { getMapSeen, peekMapSeen, revealSteps, setMapSeen } = await import('@/lib/mapReveal');

describe('revelaciones del mapa', () => {
  beforeEach(() => store.clear());

  it('sin dato toma lo que hay (no repite la historia)', () => {
    expect(peekMapSeen()).toBeNull();
    expect(getMapSeen(4)).toBe(4);
    expect(peekMapSeen()).toBe(4);
    setMapSeen(2);
    expect(getMapSeen(4)).toBe(2);
    // Progreso borrado: vuelve a cero
    expect(getMapSeen(0)).toBe(0);
  });

  it('cada jefe vencido trae su paso: el siguiente, el secreto o el Castillo', () => {
    expect(revealSteps(3, 3)).toEqual([]);
    expect(revealSteps(0, 1)).toEqual([{ beaten: 0, then: 'next' }]);
    expect(revealSteps(10, 11)).toEqual([{ beaten: 10, then: 'secret' }]);
    expect(revealSteps(11, 12)).toEqual([{ beaten: 11, then: 'castle' }]);
  });
});
