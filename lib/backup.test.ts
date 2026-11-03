import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyBackup, exportBackup, readBackup } from '@/lib/backup';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  get length() { return store.size; },
  key: (i: number) => [...store.keys()][i] ?? null,
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
});

const GAME = {
  magic_poker_progress: JSON.stringify({ defeated: 7, wins: { wall: 3 } }),
  magic_poker_castle: JSON.stringify({ conquered: 1, best: 12, run: null }),
  magic_poker_save: JSON.stringify({ v: 2, roundNumber: 3, player: { lives: 2 } }),
  magic_poker_stats: JSON.stringify({ totalGames: 40, wins: 25 }),
  magic_poker_settings: JSON.stringify({ music: 0.4, grain: 'soft' }),
  has_played_before: 'true',
};

describe('copia de seguridad', () => {
  beforeEach(() => store.clear());

  it('ida y vuelta: el otro navegador queda exactamente igual', async () => {
    Object.entries(GAME).forEach(([k, v]) => store.set(k, v));
    store.set('magic_poker_debug', '1');
    store.set('ph_analytics', 'x');
    const code = await exportBackup();
    expect(code.startsWith('MPSAVE1.')).toBe(true);

    // Otro dispositivo, con su propio progreso y cosas que no son del juego
    store.clear();
    store.set('magic_poker_progress', JSON.stringify({ defeated: 1 }));
    store.set('magic_poker_forest', '{}');
    store.set('magic_poker_low_power', '1');
    store.set('ph_analytics', 'y');
    // Pegado con saltos de línea y espacios por el medio
    const backup = await readBackup(`  ${code.slice(0, 20)}\n ${code.slice(20)} `);
    expect(backup).not.toBeNull();
    applyBackup(backup!);

    Object.entries(GAME).forEach(([k, v]) => expect(store.get(k)).toBe(v));
    // Lo del juego que no estaba en la copia se borra; lo del dispositivo y lo ajeno se queda
    expect(store.has('magic_poker_forest')).toBe(false);
    expect(store.get('magic_poker_low_power')).toBe('1');
    expect(store.get('ph_analytics')).toBe('y');
    // El modo depuración del primero no viaja
    expect(store.has('magic_poker_debug')).toBe(false);
  });

  it('un código que no lo es (o roto) no vale', async () => {
    expect(await readBackup('hola')).toBeNull();
    expect(await readBackup('MP1:shield*2|2')).toBeNull();
    store.set('magic_poker_progress', '{"defeated":3}');
    const code = await exportBackup();
    expect(await readBackup(code.slice(0, -6))).toBeNull();
  });
});
