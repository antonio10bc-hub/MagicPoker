import { describe, expect, it } from 'vitest';
import { buildDeckFrom, defaultDeckConfig, MAX_SEALS, sanitizeDeckConfig, totalSeals } from '@/lib/deck';

describe('editor de mazo', () => {
  it('por defecto: una copia de cada sello desbloqueado', () => {
    expect(defaultDeckConfig(['shield', 'life'])).toEqual({ seals: { shield: 1, life: 1 }, removed: [] });
  });

  it('respeta los límites: 2 copias por sello, sellos desbloqueados, máximo total y cartas bajas', () => {
    const c = sanitizeDeckConfig({ seals: { shield: 5, double: 2, mirror: 2 }, removed: ['2', '3', 'K', '4', '5'] }, ['shield', 'double']);
    expect(c.seals).toEqual({ shield: 2, double: 2 });
    expect(c.removed).toEqual(['2', '3', '4']);
    const many = sanitizeDeckConfig({ seals: { shield: 2, double: 2, shift: 2, swap: 2, life: 2, mirror: 2 }, removed: [] },
      ['shield', 'double', 'shift', 'swap', 'life', 'mirror']);
    expect(totalSeals(many)).toBe(MAX_SEALS);
  });

  it('construye el mazo sin las cartas quitadas y con los sellos elegidos', () => {
    const deck = buildDeckFrom({ seals: { shield: 2 }, removed: ['2', '3'] });
    expect(deck.some(c => c.rank === '2' || c.rank === '3')).toBe(false);
    expect(deck.filter(c => c.seal === 'shield')).toHaveLength(2);
    expect(deck).toHaveLength(14 - 2 + 2);
  });
});
