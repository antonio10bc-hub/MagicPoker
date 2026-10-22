import { expect, Page, test } from '@playwright/test';
import { card, fight, shot, startScenario, watchErrors } from './helpers';

// --- CASTILLO: COFRE, MAPA, DESAFÍOS, LEGENDARIAS, FASE 2 DEL SOBERANO Y CÁMARA LENTA ---

type G = { __game: { getState: () => Record<string, unknown> & { castle: { stage: number; phase2?: boolean } | null; phase: string; debugWin: () => void; opponent: { lives: number }; phase2Fx: unknown } } };
const DECK: object[] = [...['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', 'JOKER'].map(rank => ({ rank })),
  { rank: '7', bonus: 2, merchant: true }, { rank: 'KNIGHT', merchant: true }, { rank: 'DRAGON', merchant: true }, { rank: '9', seal: 'mirror' },
  { rank: 'SEAL', seal: 'shield' }, { rank: 'SEAL', wild: true, merchant: true }];

const seed = async (page: Page, items: Record<string, unknown>) => {
  await page.addInitScript(p => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('has_played_before', 'true');
    localStorage.setItem('magic_poker_tutorial_done', '1');
    localStorage.setItem('magic_poker_settings', JSON.stringify({ grain: 'off', music: 0, sfx: 0 }));
    Object.entries(p).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
  }, items);
  await page.goto('/');
  await page.waitForTimeout(1800);
};

/** Cierra la presentación del Castillo (espera a que evolucione y toca) */
const closeIntro = async (page: Page) => {
  await page.waitForTimeout(2600);
  const intro = page.locator('[aria-label="boss intro"]');
  if (await intro.isVisible()) await intro.click();
  await expect(intro).toBeHidden();
};

test('cofre tras el piso 3: se abre, da su premio y luego llega el mercader con el mapa', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await seed(page, { magic_poker_progress: { defeated: 12 }, magic_poker_castle: { run: { stage: 2, lives: 4, maxLives: 4, deck: DECK }, best: 2, conquered: 0 } });
  await shot(page, info, 'menu-mapa');
  await page.getByText('SEGUIR').first().click({ force: true });
  await page.waitForFunction(() => (window as unknown as G).__game.getState().castle?.stage === 2);
  await closeIntro(page);
  await page.evaluate(() => (window as unknown as G).__game.getState().debugWin());
  const chest = page.getByText('Toca para abrirlo');
  for (let i = 0; i < 12 && !(await chest.isVisible()); i++) {
    await page.mouse.click(page.viewportSize()!.width / 2, page.viewportSize()!.height * 0.3);
    await page.waitForTimeout(600);
  }
  await expect(chest).toBeVisible();
  await shot(page, info, 'cofre-cerrado');
  await chest.click({ force: true });
  await page.waitForTimeout(900);
  await shot(page, info, 'cofre-temblando');
  await page.waitForTimeout(1700);
  await expect(page.getByText('Seguir', { exact: true })).toBeVisible();
  await shot(page, info, 'cofre-abierto');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('magic_poker_castle')!).run.chest)).toBeUndefined();
  await page.getByText('Seguir', { exact: true }).click({ force: true });
  await expect(page.getByText('EL MERCADER')).toBeVisible();
  await expect(page.locator('[aria-label="map 3/12"]')).toBeVisible();
  await page.waitForTimeout(2600);
  await shot(page, info, 'mercader-mapa');
  // Tus vidas y tu mazo, a la vista para decidir
  await expect(page.locator('[aria-label="lives 4/4"]')).toBeVisible();
  await page.locator('[aria-label="run deck"]').click();
  await expect(page.getByText(/Tu mazo \(\d+ cartas\)/)).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, info, 'mercader-mazo');
  await page.locator('[aria-label="close run deck"]').click();
  noErrors();
});

test('rarezas: una legendaria en la oferta del mercader (al volver del menú)', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  const offer = [{ kind: 'heal' }, { kind: 'seal', seal: 'mirror', target: 0 }, { kind: 'card', rank: 'DRAGON' }];
  await seed(page, { magic_poker_progress: { defeated: 12 }, magic_poker_castle: { run: { stage: 7, lives: 2, maxLives: 4, deck: DECK, offer }, best: 7, conquered: 0 } });
  await page.getByText('SEGUIR').first().click({ force: true });
  await expect(page.locator('[data-rarity="legendary"]')).toBeVisible();
  await expect(page.getByText('LEGENDARIA')).toBeVisible();
  await page.waitForTimeout(800);
  await shot(page, info, 'rarezas');
  await expect(page.locator('[aria-label="lives 2/4"]')).toBeVisible();
  await page.locator('[aria-label="run deck"]').click();
  await page.waitForTimeout(300);
  await shot(page, info, 'rarezas-mazo');
  noErrors();
});

test('desafíos: tras conquistarlo, se eligen al entrar y cambian la subida', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await seed(page, { magic_poker_progress: { defeated: 12 }, magic_poker_castle: { run: null, best: 12, conquered: 1, bestChallenges: 1 } });
  await expect(page.getByText('Récord: conquistado con 1/5 desafíos')).toBeVisible();
  await page.getByText('ENTRAR').first().click({ force: true });
  await expect(page.getByText('DESAFÍOS', { exact: true })).toBeVisible();
  await page.locator('[aria-label="challenge fragile"]').click();
  await page.locator('[aria-label="challenge fierce"]').click();
  await shot(page, info, 'desafios');
  await page.getByText('ENTRAR · 2 desafíos').click({ force: true });
  await page.waitForFunction(() => (window as unknown as G).__game.getState().castle?.stage === 0);
  const run = await page.evaluate(() => JSON.parse(localStorage.getItem('magic_poker_castle')!).run);
  expect(run.challenges.sort()).toEqual(['fierce', 'fragile']);
  expect(run.maxLives).toBe(3);
  noErrors();
});

test('fase 2 del Soberano: a mitad de vida se transforma y se cura entero', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await startScenario(page, {
    defeated: 12, bossIndex: 11, castle: true,
    player: { lives: 4, board: [card('player', '9', 'a'), card('player', '10', 'b'), card('player', '8', 'c')] },
    opponent: { lives: 6, maxLives: 6, board: [] },
    castleState: { run: { stage: 11, lives: 4, maxLives: 4, deck: DECK }, best: 11, conquered: 0 },
  });
  await fight(page);
  await page.waitForFunction(() => (window as unknown as G).__game.getState().phase2Fx !== null, undefined, { timeout: 15_000 });
  // La lógica ya le ha curado; el panel enseña primero la bajada a la mitad
  expect(await page.evaluate(() => (window as unknown as G).__game.getState().opponent.lives)).toBe(6);
  await page.waitForTimeout(1200);
  await expect(page.getByText('¡MITAD DE VIDA!')).toBeVisible();
  await shot(page, info, 'fase2-1-mitad');
  // Los logros esperan a que termine la cinemática
  await expect(page.getByText('¡LOGRO NUEVO!')).toBeHidden();
  await page.waitForTimeout(3000);
  await shot(page, info, 'fase2-2-se-alza');
  await page.waitForTimeout(3000);
  await shot(page, info, 'fase2-3-corazones');
  await page.waitForTimeout(2200);
  await expect(page.getByText('EL SOBERANO DESPIERTA')).toBeVisible();
  await shot(page, info, 'fase2-4-despierta');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('magic_poker_save') ?? '{}').phase2 ?? (window as unknown as G).__game.getState().castle?.phase2)).toBe(true);
  await page.locator('[aria-label="phase 2"]').click();
  await expect(page.locator('[aria-label="phase 2"]')).toBeHidden();
  noErrors();
});

test('golpe decisivo a cámara lenta y cartas legendarias en la mesa', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await startScenario(page, {
    player: { lives: 4, board: [card('player', 'DRAGON', 'd', { merchant: true }), card('player', 'PHOENIX', 'p', { merchant: true }), card('player', 'HYDRA', 'h', { merchant: true })] },
    opponent: { lives: 1, board: [card('opponent', '5', 'x'), null, null, null] },
  });
  await page.waitForTimeout(800);
  await shot(page, info, 'legendarias');
  await fight(page);
  // La cámara lenta llega con el resultado de la pelea
  await page.waitForFunction(() => !!(window as unknown as { __game: { getState: () => { pendingCombatResult: unknown } } }).__game.getState().pendingCombatResult, undefined, { timeout: 15_000 });
  await page.waitForTimeout(700);
  await shot(page, info, 'camara-lenta');
  noErrors();
});

test('resumen al conquistar el Castillo: estadísticas y mazo final (y desde el menú)', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  const stats = { startedAt: Date.now() - 1000 * 60 * 23, rounds: 41, damageDealt: 58, livesLost: 9, cardsDestroyed: 37, cardsLost: 22, bestHit: 4,
    boons: { common: 6, rare: 4, legendary: 1 }, chests: 3 };
  await seed(page, { magic_poker_progress: { defeated: 12 }, magic_poker_castle: { run: { stage: 11, lives: 3, maxLives: 5, deck: DECK, challenges: ['fierce', 'short'], stats }, best: 11, conquered: 0 } });
  await page.getByText('SEGUIR').first().click({ force: true });
  await page.waitForFunction(() => (window as unknown as G).__game.getState().castle?.stage === 11);
  await closeIntro(page);
  await page.evaluate(() => (window as unknown as G).__game.getState().debugWin());
  const btn = page.locator('[aria-label="run summary"]');
  for (let i = 0; i < 14 && !(await btn.isVisible()); i++) {
    await page.mouse.click(page.viewportSize()!.width / 2, page.viewportSize()!.height * 0.3);
    await page.waitForTimeout(700);
  }
  await expect(btn).toBeVisible();
  await shot(page, info, 'conquistado');
  await btn.click({ force: true });
  await expect(page.getByText('RESUMEN DE LA SUBIDA')).toBeVisible();
  await expect(page.getByText('Tu mazo final (20 cartas)')).toBeVisible();
  await page.waitForTimeout(500);
  await shot(page, info, 'resumen');
  // Desde el menú: el resumen de la última subida
  await page.keyboard.press('Escape');
  await page.evaluate(() => (window as unknown as { __game: { getState: () => { exitToMenu: () => void } } }).__game.getState().exitToMenu());
  await page.waitForTimeout(1500);
  await page.locator('.no-scrollbar').first().evaluate(e => { e.scrollLeft = e.scrollWidth; });
  await page.waitForTimeout(700);
  await expect(page.locator('[aria-label="last summary"]')).toBeVisible();
  noErrors();
});
