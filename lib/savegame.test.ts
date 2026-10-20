import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('window', {});
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
});

const { loadGame, saveGame } = await import('@/lib/savegame');
const { createPlayerState, createDeck } = await import('@/lib/game-utils');

describe('partida guardada', () => {
  beforeEach(() => store.clear());

  it('se guarda y se retoma', () => {
    const side = createPlayerState(createDeck('player'), 3, true);
    saveGame({ difficulty: 'hard', roundNumber: 2, bossIndex: 1, player: side, opponent: side });
    expect(loadGame()?.roundNumber).toBe(2);
  });

  it('una partida de una versión antigua se descarta sin errores', () => {
    store.set('magic_poker_save', JSON.stringify({ v: 1, difficulty: 'hard', roundNumber: 2, player: {}, opponent: {} }));
    expect(loadGame()).toBeNull();
    expect(store.has('magic_poker_save')).toBe(false);
  });

  it('cartas o sellos que ya no existen, o datos rotos: se descarta', () => {
    const side = createPlayerState(createDeck('player'), 3, true);
    const bad = { ...side, hand: [{ ...side.hand[0], seal: 'teleport' }] };
    saveGame({ difficulty: 'hard', roundNumber: 2, player: bad as never, opponent: side });
    expect(loadGame()).toBeNull();
    store.set('magic_poker_save', '{no es json');
    expect(loadGame()).toBeNull();
  });
});
