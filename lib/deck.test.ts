import { describe, expect, it, vi } from 'vitest';
import { buildDeckFrom, decodeDeck, defaultDeckConfig, encodeDeck, MAX_SEALS, sanitizeDeckConfig, totalSeals } from '@/lib/deck';

describe('editor de mazo', () => {
  it('por defecto: una copia de cada sello desbloqueado', () => {
    expect(defaultDeckConfig(['shield', 'life'])).toEqual({ seals: { shield: 1, life: 1 }, removed: [] });
  });

  it('respeta los límites: 2 copias por sello, sellos desbloqueados, 5 en total y 3 cartas fuera', () => {
    const c = sanitizeDeckConfig({ seals: { shield: 5, double: 2, mirror: 2 }, removed: ['A', 'K', 'JOKER', '4', '5'] }, ['shield', 'double']);
    expect(c.seals).toEqual({ shield: 2, double: 2 });
    // Cualquier carta del mazo, hasta 3
    expect(c.removed).toEqual(['A', 'K', 'JOKER']);
    const many = sanitizeDeckConfig({ seals: { shield: 2, double: 2, shift: 2, swap: 2 }, removed: [] }, ['shield', 'double', 'shift', 'swap']);
    expect(totalSeals(many)).toBe(MAX_SEALS);
    expect(MAX_SEALS).toBe(5);
  });

  it('construye el mazo sin las cartas quitadas y con los sellos elegidos', () => {
    const deck = buildDeckFrom({ seals: { shield: 2 }, removed: ['2', '3'] });
    expect(deck.some(c => c.rank === '2' || c.rank === '3')).toBe(false);
    expect(deck.filter(c => c.seal === 'shield')).toHaveLength(2);
    expect(deck).toHaveLength(14 - 2 + 2);
  });
});

describe('mazos guardados', () => {
  it('tres ranuras: cada una guarda su mazo y la activa es la que se juega', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    });
    vi.resetModules();
    const d = await import('@/lib/deck');
    d.saveDeckConfig({ seals: { shield: 2 }, removed: [] });
    d.setActiveSlot(1);
    expect(d.getDeckConfig()).toBeNull();
    d.saveDeckConfig({ seals: {}, removed: ['K'] });
    expect(d.savedSlots()).toEqual([true, true, false]);
    d.setActiveSlot(0);
    expect(d.getDeckConfig()?.seals.shield).toBe(2);
    vi.unstubAllGlobals();
  });
});

describe('copiar y pegar mazos', () => {
  it('un mazo va y vuelve por su código', () => {
    const config = { seals: { shield: 2, anchor: 1 }, removed: ['2', '3'] as const };
    const code = encodeDeck({ ...config, removed: [...config.removed] });
    expect(code).toBe('MP1:shield*2.anchor*1|2.3');
    expect(decodeDeck(code)).toEqual({ seals: { shield: 2, anchor: 1 }, removed: ['2', '3'] });
    expect(decodeDeck(' MP1:|')).toEqual({ seals: {}, removed: [] });
  });

  it('lo que no es un código de mazo no se pega', () => {
    expect(decodeDeck('hola')).toBeNull();
    expect(decodeDeck('MP1:shield*x|')).toBeNull();
  });
});
