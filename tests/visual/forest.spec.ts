import { expect, Page, test } from '@playwright/test';
import { passCoin, shot, watchErrors } from './helpers';

// --- EL BOSQUE ---
// Se abre al conquistar el Castillo (anunciándose por fases), su pantalla en primera
// persona, buscar duelo (ojos → alguien sale → se abalanza), el duelo, volver al bosque
// y el bestiario.

type G = { __game: { getState: () => { screen: string; phase: string; forest: { id: string; tier: string } | null; debugWin: () => void } } };

const seed = async (page: Page, items: Record<string, unknown>) => {
  await page.addInitScript(p => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('has_played_before', 'true');
    localStorage.setItem('magic_poker_tutorial_done', '1');
    localStorage.setItem('magic_poker_settings', JSON.stringify({ grain: 'off', quality: 'high', music: 0, sfx: 0 }));
    Object.entries(p).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
  }, items);
  await page.goto('/');
  await page.waitForTimeout(1800);
};

const CONQUERED = { magic_poker_progress: { defeated: 12 }, magic_poker_map_seen: 12, magic_poker_castle: { best: 12, conquered: 1 } };

test('el Bosque despierta al conquistar el Castillo y aparece su botón', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await seed(page, CONQUERED);
  await expect(page.locator('[aria-label="forest awaken"]')).toBeAttached();
  await page.waitForTimeout(1600);
  await shot(page, info, 'despierta-1-ojos');
  await page.waitForTimeout(1500);
  await shot(page, info, 'despierta-2-titulo');
  await expect(page.locator('[aria-label="forest awaken"]')).toHaveCount(0, { timeout: 6000 });
  await expect(page.locator('[aria-label="forest"]')).toBeVisible();
  await page.waitForTimeout(600);
  await shot(page, info, 'despierta-3-boton');
  expect(await page.evaluate(() => localStorage.getItem('magic_poker_forest_seen'))).toBe('1');
  noErrors();
});

test('bosque: buscar duelo, alguien sale y se abalanza; el duelo; volver al bosque y el bestiario', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await seed(page, { ...CONQUERED, magic_poker_forest_seen: 1 });
  await page.locator('[aria-label="forest"]').click();
  await expect(page.getByText('BUSCAR DUELO')).toBeVisible();
  await page.waitForTimeout(900);
  await shot(page, info, 'bosque-1-quieto');
  await page.getByText('BUSCAR DUELO').click({ force: true });
  await expect(page.locator('[aria-label="forest encounter"]')).toBeAttached();
  await page.waitForTimeout(700);
  await shot(page, info, 'bosque-2-ojos');
  await page.waitForTimeout(1400);
  await shot(page, info, 'bosque-3-sale');
  await page.waitForTimeout(1500);
  await shot(page, info, 'bosque-4-se-abalanza');
  await passCoin(page);
  await page.waitForFunction(() => (window as unknown as G).__game.getState().phase === 'placement', undefined, { timeout: 8000 });
  const forest = await page.evaluate(() => (window as unknown as G).__game.getState().forest);
  expect(forest).not.toBeNull();
  await page.waitForTimeout(800);
  await shot(page, info, 'bosque-5-duelo');
  await page.evaluate(() => (window as unknown as G).__game.getState().debugWin());
  const back = page.getByText('VOLVER AL BOSQUE');
  for (let i = 0; i < 12 && !(await back.isVisible()); i++) {
    const vp = page.viewportSize()!;
    await page.mouse.click(vp.width / 2, vp.height * 0.35);
    await page.waitForTimeout(700);
  }
  await expect(back).toBeVisible();
  await shot(page, info, 'bosque-6-victoria');
  await back.click({ force: true });
  await expect(page.getByText('BUSCAR DUELO')).toBeVisible();
  // El bestiario ya lo conoce
  await page.locator('[aria-label="bestiario"]').click();
  await expect(page.locator(`[aria-label="bestiary ${forest!.id}"]`)).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, info, 'bosque-7-bestiario');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('magic_poker_forest')!));
  expect(stored.duels).toBe(1);
  expect(stored.streak).toBe(1);
  // Copiar su mazo y pegarlo en el editor (con el botón del mazo de esta misma pantalla)
  await page.locator(`[aria-label="copy deck ${forest!.id}"]`).click();
  await expect(page.getByText('¡Copiado! Pégalo en el editor')).toBeVisible();
  await shot(page, info, 'bosque-8-copiado');
  await page.locator('[aria-label="cerrar"]').first().click();
  await expect(page.getByText('BESTIARIO')).toHaveCount(0);
  await page.locator('[aria-label="mazo"]').click();
  await page.locator('[aria-label="paste deck"]').click();
  await expect(page.getByText('¡Pegado!')).toBeVisible();
  await shot(page, info, 'bosque-9-pegado');
  const code = await page.evaluate(() => localStorage.getItem('magic_poker_deck_clip'));
  const decks = await page.evaluate(() => JSON.parse(localStorage.getItem('magic_poker_decks')!));
  expect(code).toMatch(/^MP1:/);
  const seals = Object.keys(decks.slots[decks.active].seals);
  expect(seals.length).toBeGreaterThan(0);
  code!.slice(4).split('|')[0].split('.').forEach(item => expect(seals).toContain(item.split('*')[0]));
  noErrors();
});

test('únicos: el Rey sale con su aura (forzado desde depuración) y lleva tres Reyes; bestiario por niveles', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await seed(page, {
    ...CONQUERED, magic_poker_forest_seen: 1, magic_poker_debug: 1,
    magic_poker_forest: { seen: { woodcutter: { normal: { wins: 2, losses: 1 } }, witch: { hard: { wins: 1, losses: 0 } }, wolf: { nightmare: { wins: 0, losses: 2 } }, queen: { unique: { wins: 1, losses: 0 } } }, duels: 7, streak: 1, bestStreak: 2 },
  });
  await page.locator('[aria-label="debug"]').click();
  await page.getByText('Rey', { exact: true }).click();
  await expect(page.getByText('BUSCAR DUELO')).toBeVisible();
  await page.waitForTimeout(1000);
  await page.getByText('BUSCAR DUELO').click({ force: true });
  await expect(page.locator('[aria-label="forest encounter"]')).toBeAttached();
  await page.waitForTimeout(2600);
  await shot(page, info, 'unico-1-rey');
  await passCoin(page);
  await page.waitForFunction(() => (window as unknown as G).__game.getState().phase === 'placement', undefined, { timeout: 10000 });
  const kings = await page.evaluate(() => {
    const s = (window as unknown as { __game: { getState: () => { forest: { tier: string }; opponent: { hand: { rank: string }[]; deck: { rank: string }[] } } } }).__game.getState();
    return { tier: s.forest.tier, k: [...s.opponent.hand, ...s.opponent.deck].filter(c => c.rank === 'K').length, q: [...s.opponent.hand, ...s.opponent.deck].filter(c => c.rank === 'Q' || c.rank === 'J').length };
  });
  expect(kings).toEqual({ tier: 'unique', k: 3, q: 0 });
  await page.waitForTimeout(600);
  await shot(page, info, 'unico-2-duelo');
  // Al bestiario, por niveles
  await page.evaluate(() => (window as unknown as { __game: { getState: () => { enterForest: () => void } } }).__game.getState().enterForest());
  await page.locator('[aria-label="bestiario"]').click();
  await expect(page.getByText('Únicos', { exact: true })).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, info, 'unico-3-bestiario');
  await page.locator('[aria-label="bestiary queen"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shot(page, info, 'unico-4-bestiario-unicos');
  noErrors();
});
