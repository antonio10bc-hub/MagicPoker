import { expect, Page, test } from '@playwright/test';
import { shot, watchErrors } from './helpers';

// --- COPIA DE SEGURIDAD ---
// Ajustes → Copia de seguridad: copiar el código en un navegador y pegarlo en otro lo
// deja exactamente igual (progreso, Castillo, estadísticas, ajustes, partida a medias…).

const A: Record<string, string> = {
  has_played_before: 'true',
  magic_poker_tutorial_done: '1',
  magic_poker_prologue: 'done',
  magic_poker_settings: JSON.stringify({ grain: 'off', music: 0, sfx: 0 }),
  magic_poker_progress: JSON.stringify({ defeated: 7, wins: { drifter: 4, wall: 2 } }),
  magic_poker_castle: JSON.stringify({ conquered: 1, best: 12, run: null }),
  magic_poker_forest_seen: '1',
  magic_poker_map_seen: '7',
  magic_poker_stats: JSON.stringify({ totalGames: 31, wins: 20 }),
};

const open = async (page: Page, items: Record<string, string>) => {
  await page.addInitScript(i => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    Object.entries(i).forEach(([k, v]) => localStorage.setItem(k, v));
  }, items);
  await page.goto('/');
  await page.waitForTimeout(1800);
  await page.locator('[aria-label="ajustes"]').first().click({ force: true });
  await page.locator('[aria-label="backup"]').click({ force: true });
  await page.waitForTimeout(400);
};

const gameKeys = (page: Page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage)
  .filter(k => (k.startsWith('magic_poker_') || k === 'has_played_before') && k !== 'magic_poker_low_power' && k !== 'magic_poker_debug')
  .map(k => [k, localStorage.getItem(k)])));

test('copiar en un navegador y pegar en otro deja el juego igual', async ({ browser, baseURL, viewport }, info) => {
  // Contextos nuevos: con la dirección, el idioma y la pantalla del proyecto
  const base = { baseURL, locale: 'es-ES', viewport };
  // Navegador A: copia
  const ctxA = await browser.newContext({ ...base, permissions: ['clipboard-read', 'clipboard-write'] });
  const a = await ctxA.newPage();
  const noErrorsA = watchErrors(a);
  await open(a, A);
  await a.locator('[aria-label="backup copy"]').click({ force: true });
  await expect(a.getByText(/Copiado|Copied/)).toBeVisible();
  const code = await a.evaluate(() => navigator.clipboard.readText());
  expect(code.startsWith('MPSAVE1.')).toBe(true);
  const original = await gameKeys(a);
  await shot(a, info, 'copia');
  noErrorsA();

  // Navegador B: otro progreso; pega y carga
  const ctxB = await browser.newContext(base);
  const b = await ctxB.newPage();
  const noErrorsB = watchErrors(b);
  await open(b, { has_played_before: 'true', magic_poker_tutorial_done: '1', magic_poker_prologue: 'done', magic_poker_progress: JSON.stringify({ defeated: 1 }), magic_poker_forest: '{}' });
  await b.locator('[aria-label="backup code"]').fill('esto no es un código');
  await b.locator('[aria-label="backup load"]').click({ force: true });
  await expect(b.getByText(/no es una copia|isn't a valid/)).toBeVisible();
  await b.locator('[aria-label="backup code"]').fill(code);
  await b.locator('[aria-label="backup load"]').click({ force: true });
  await shot(b, info, 'confirmar');
  await b.getByText(/CARGAR COPIA|LOAD BACKUP/).click({ force: true });
  await b.waitForLoadState('load');
  await b.waitForTimeout(1500);
  expect(await gameKeys(b)).toEqual(original);
  noErrorsB();
  await ctxA.close();
  await ctxB.close();
});
