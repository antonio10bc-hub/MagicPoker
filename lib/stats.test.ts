import { describe, expect, it } from 'vitest';
import { playedKey } from '@/lib/stats';

describe('estadísticas', () => {
  it('cada sello cuenta aparte para la carta favorita; el resto, por su rango', () => {
    expect(playedKey('SEAL', 'shield')).toBe('SEAL:shield');
    expect(playedKey('SEAL', 'echo')).toBe('SEAL:echo');
    expect(playedKey('K')).toBe('K');
    expect(playedKey('JESTER')).toBe('JESTER');
    // Un sello sin saber cuál (no debería pasar) cae en el montón de antes
    expect(playedKey('SEAL')).toBe('SEAL');
  });
});
