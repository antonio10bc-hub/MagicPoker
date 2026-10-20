import { expect, Page, test } from '@playwright/test';
import { card, shot, startScenario, watchErrors } from './helpers';

// --- MENÚ, VENTANAS Y PAUSA ---

const openMenu = async (page: Page, progress: { defeated: number; rematches?: string[] }) => {
  await page.addInitScript(p => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('has_played_before', 'true');
    localStorage.setItem('magic_poker_tutorial_done', '1');
    localStorage.setItem('magic_poker_settings', JSON.stringify({ grain: 'off', music: 0, sfx: 0 }));
    localStorage.setItem('magic_poker_progress', JSON.stringify(p));
  }, progress);
  await page.goto('/');
  await page.waitForTimeout(1800);
};

/** Número de páginas del carrusel de bosses (los puntos de abajo) */
const bossPages = (page: Page) => page.locator('.no-scrollbar > div').count();

test('el jefe secreto no sale hasta vencer a los demás', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await openMenu(page, { defeated: 10 });
  expect(await bossPages(page)).toBe(11);
  await shot(page, info, 'menu-sin-secreto');
  await page.evaluate(() => localStorage.setItem('magic_poker_progress', JSON.stringify({ defeated: 11 })));
  await page.reload();
  await page.waitForTimeout(1800);
  expect(await bossPages(page)).toBe(12);
  await expect(page.getByText('JEFE SECRETO')).toBeVisible();
  await shot(page, info, 'menu-jefe-secreto');
  noErrors();
});

test('revancha: botón bajo JUGAR con un boss vencido', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await openMenu(page, { defeated: 3, rematches: ['wall'] });
  // Se desliza el carrusel hasta El Muro (vencido)
  await page.locator('.no-scrollbar').first().evaluate(e => { e.scrollLeft = e.clientWidth; });
  await page.waitForTimeout(600);
  await expect(page.getByText('REVANCHA', { exact: true })).toBeVisible();
  await shot(page, info, 'menu-revancha');
  await page.getByText('REVANCHA', { exact: true }).click({ force: true });
  await page.waitForFunction(() => (window as unknown as { __game: { getState: () => { rematch: boolean } } }).__game.getState().rematch);
  await page.waitForTimeout(2500);
  await shot(page, info, 'partida-revancha');
  noErrors();
});

test('editor de mazo (todos los jefes vencidos)', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await openMenu(page, { defeated: 12 });
  await page.locator('[aria-label=deck]').click({ force: true });
  await page.waitForTimeout(500);
  // Por defecto lleva un sello de cada (10, el máximo): se quita uno para poder subir otro
  await page.locator('[aria-label="less double"]').click({ force: true });
  await page.locator('[aria-label="more shield"]').click({ force: true });
  await page.locator('[aria-label="remove 2"]').click({ force: true });
  await expect(page.getByText('Tu mazo: 23 cartas')).toBeVisible();
  await shot(page, info, 'editor');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('magic_poker_deck') ?? 'null'));
  expect(saved.seals.shield).toBe(2);
  expect(saved.removed).toEqual(['2']);
  noErrors();
});

test('catálogo de cartas desde ajustes', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await openMenu(page, { defeated: 2 });
  await page.locator('[aria-label=settings]').click({ force: true });
  await page.getByText('Catálogo de cartas').click({ force: true });
  await page.waitForTimeout(500);
  await expect(page.getByText('Bufón')).toBeAttached();
  await expect(page.getByText('Sello de espejo')).toBeAttached();
  await shot(page, info, 'catalogo');
  noErrors();
});

test('pausa: el rival no juega mientras está abierta y x2 se guarda', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await startScenario(page, {
    player: { board: [card('player', '5', 'a')], hand: [card('player', '3', 'h1'), card('player', '4', 'h2')] },
    opponent: { board: [] },
  });
  // El rival no está plantado en esta prueba: juega después de ti
  await page.evaluate(() => {
    const g = (window as unknown as { __game: { setState: (p: object) => void; getState: () => { opponent: object } } }).__game;
    g.setState({ opponent: { ...g.getState().opponent, isPassed: false, hand: [{ id: 'opponent-7-x', rank: '7', owner: 'opponent', suit: 'standard', value: 7, isFaceUp: false }] } });
  });
  // Se pausa y, con la pausa abierta, se juega: el turno del rival queda en espera
  await page.locator('[aria-label=pause]').click();
  await expect(page.getByText('PAUSA', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as unknown as { __game: { getState: () => { placeCard: (id: string, slot: number) => void } } }).__game.getState().placeCard('player-3-h1', 2));
  await page.waitForTimeout(2500);
  await shot(page, info, 'pausa');
  const during = await page.evaluate(() => (window as unknown as { __game: { getState: () => { opponent: { board: { card: unknown }[] } } } }).__game.getState().opponent.board.filter(s => s.card).length);
  expect(during).toBe(0);
  await page.getByText('x2', { exact: true }).first().click({ force: true });
  await page.getByText('SEGUIR').click({ force: true });
  await page.waitForTimeout(2000);
  const after = await page.evaluate(() => (window as unknown as { __game: { getState: () => { opponent: { board: { card: unknown }[] } } } }).__game.getState().opponent.board.filter(s => s.card).length);
  expect(after).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('magic_poker_settings')!).speed)).toBe(2);
  noErrors();
});
