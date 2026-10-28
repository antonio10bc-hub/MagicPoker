import { expect, Page, TestInfo } from '@playwright/test';
import type { BoardSlot, Card, PlayerState, Rank, SealId } from '@/types';

// --- AYUDAS DE LOS TESTS VISUALES ---
// Partidas preparadas: se escribe una partida guardada en localStorage y se retoma con
// "Continuar partida". El estado del juego se lee con window.__game (solo en desarrollo).

const VALUES: Partial<Record<Rank, number>> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14,
  JESTER: 6, TOWER: 15, BOMB: 4, SPY: 3, KNIGHT: 9, PRIESTESS: 5, DRAGON: 16, HYDRA: 7, PHOENIX: 8,
};

export const card = (owner: 'player' | 'opponent', rank: Rank, id: string, extra: Partial<Card> = {}): Card => ({
  id: `${owner}-${rank}-${id}`, rank, owner, suit: 'standard', value: VALUES[rank] ?? 0, isFaceUp: owner === 'player', ...extra,
});

export const sealCard = (owner: 'player' | 'opponent', seal: SealId, id: string): Card => ({
  id: `${owner}-SEAL-${seal}-${id}`, rank: 'SEAL', owner, suit: 'seal', value: 0, isFaceUp: owner === 'player', seal,
});

export const board = (cards: (Card | null)[]): BoardSlot[] => [0, 1, 2, 3].map(index => ({ index, card: cards[index] ?? null }));

const side = (lives: number, boardCards: (Card | null)[], hand: Card[] = [], passed = false): PlayerState => ({
  lives, maxLives: Math.max(lives, 4), isPassed: passed, hand,
  deck: [card('player', '2', 'd1'), card('player', '3', 'd2'), card('player', '4', 'd3')],
  board: board(boardCards),
});

export interface Scenario {
  defeated?: number;
  player: { lives?: number; board: (Card | null)[]; hand?: Card[] };
  opponent: { lives?: number; maxLives?: number; board: (Card | null)[] };
  bossIndex?: number;
  /** Pelea del Castillo */
  castle?: boolean;
  /** Estado de la subida del Castillo (magic_poker_castle) */
  castleState?: object;
}

/** Abre el juego con una partida preparada y la retoma */
export const startScenario = async (page: Page, s: Scenario) => {
  const save = {
    v: 2, difficulty: 'hard', roundNumber: 2, bossIndex: s.bossIndex ?? 1, castle: s.castle,
    player: side(s.player.lives ?? 3, s.player.board, s.player.hand ?? [card('player', '3', 'h1')]),
    opponent: { ...side(s.opponent.lives ?? 5, s.opponent.board, [], true), maxLives: s.opponent.maxLives ?? 5 },
  };
  await page.addInitScript(([progress, saved, castleState]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('has_played_before', 'true');
    localStorage.setItem('magic_poker_tutorial_done', '1');
    localStorage.setItem('magic_poker_settings', JSON.stringify({ grain: 'off', quality: 'high', music: 0, sfx: 0 }));
    localStorage.setItem('magic_poker_progress', JSON.stringify({ defeated: progress }));
    localStorage.setItem('magic_poker_save', JSON.stringify(saved));
    if (castleState) localStorage.setItem('magic_poker_castle', JSON.stringify(castleState));
  }, [s.defeated ?? 6, save, s.castleState ?? null] as const);
  await page.goto('/');
  // Igual que "Continuar partida" (sin depender de cuándo se puede pulsar el botón)
  await page.waitForFunction(() => !!(window as unknown as { __game?: unknown }).__game);
  await page.getByText(/continuar partida/i).waitFor();
  await page.evaluate(() => (window as unknown as { __game: { getState: () => { resumeGame: () => boolean } } }).__game.getState().resumeGame());
  await page.waitForFunction(() => (window as unknown as { __game: { getState: () => { phase: string } } }).__game.getState().phase === 'placement');
  // Se guarda el último resultado de pelea: la cuenta atrás de CONTINUAR puede cerrar
  // la pelea mientras se hacen las capturas
  await page.evaluate(() => {
    const w = window as unknown as { __game: { subscribe: (f: (s: { pendingCombatResult: unknown }) => void) => void }; __lastResult?: unknown };
    w.__game.subscribe(s => { if (s.pendingCombatResult) w.__lastResult = s.pendingCombatResult; });
  });
  await page.waitForTimeout(600);
};

type GameWindow = { __game: { getState: () => Record<string, unknown> & { passTurn: () => void; finishCombatPhase: () => void } } };

export const state = (page: Page) => page.evaluate(() => {
  const s = (window as unknown as GameWindow).__game.getState();
  const last = (window as unknown as { __lastResult?: unknown }).__lastResult;
  return JSON.parse(JSON.stringify({ phase: s.phase, player: s.player, opponent: s.opponent, result: s.pendingCombatResult ?? last ?? null })) as {
    phase: string; player: PlayerState; opponent: PlayerState;
    result: { deadCardIds: string[]; reflected: { mirrorId: string }[]; poisonedIds: string[]; shieldedIds: string[] } | null;
  };
});

/** Te plantas (el rival ya está plantado) y empieza la pelea */
export const fight = (page: Page) => page.evaluate(() => (window as unknown as GameWindow).__game.getState().passTurn());

/** Espera a que la pelea esté resuelta (o ya cerrada por la cuenta atrás) */
export const waitFought = (page: Page) =>
  page.waitForFunction(() => {
    const w = window as unknown as GameWindow & { __lastResult?: unknown };
    return !!w.__lastResult && w.__game.getState().phase !== 'combat';
  }, undefined, { timeout: 15_000 });

/** Continuar tras la pelea (si la cuenta atrás no lo ha hecho ya) */
export const finish = async (page: Page) => {
  await page.evaluate(() => {
    const g = (window as unknown as GameWindow).__game.getState();
    if (g.phase === 'combat-reveal') g.finishCombatPhase();
  });
  await page.waitForFunction(() => (window as unknown as GameWindow).__game.getState().phase === 'placement');
};

/** Cara o cruz: espera a que caiga la moneda y toca para empezar la partida */
export const passCoin = async (page: Page) => {
  await page.locator('[data-coin-ready]').waitFor({ timeout: 15_000 });
  await page.locator('[aria-label="coin toss"]').click();
  await page.waitForFunction(() => (window as unknown as { __game: { getState: () => { phase: string } } }).__game.getState().phase !== 'start');
};

/** Captura para revisar a ojo (se adjunta al informe y se guarda en test-results) */
export const shot = async (page: Page, info: TestInfo, name: string) => {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path });
  await info.attach(name, { path, contentType: 'image/png' });
};

/** Capturas seguidas durante la pelea (la coreografía dura ~1,5 s) */
export const filmFight = async (page: Page, info: TestInfo, name: string, frames = 8, every = 220) => {
  for (let i = 0; i < frames; i++) {
    await shot(page, info, `${name}-${String(i).padStart(2, '0')}`);
    await page.waitForTimeout(every);
  }
};

/** Sin errores de la página durante el test */
export const watchErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  return () => expect(errors).toEqual([]);
};
