import { expect, Page, test } from '@playwright/test';
import { card, filmFight, fight, sealCard, shot, startScenario, state, waitFought, watchErrors } from './helpers';

// --- EL CASTILLO, DORSOS Y CARTAS NUEVAS ---

type G = { __game: { getState: () => Record<string, unknown> & { castle: { stage: number } | null; phase: string; debugWin: () => void } } };

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

test('el Castillo: entrar, vencer al primer jefe, el mercader ofrece mejoras y subir al siguiente', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await seed(page, { magic_poker_progress: { defeated: 12 } });
  await expect(page.getByText('EL CASTILLO').first()).toBeVisible();
  await shot(page, info, 'menu-castillo');
  await page.getByText('ENTRAR').click({ force: true });
  await page.waitForTimeout(900);
  await shot(page, info, 'presentacion');
  await page.waitForFunction(() => (window as unknown as G).__game.getState().castle?.stage === 0);
  await page.waitForTimeout(2400);
  await shot(page, info, 'piso-1');
  await page.evaluate(() => (window as unknown as G).__game.getState().debugWin());
  const choose = page.getByText('Elige una mejora');
  for (let i = 0; i < 10 && !(await choose.isVisible()); i++) {
    const vp = page.viewportSize()!;
    await page.mouse.click(vp.width / 2, vp.height * 0.35);
    await page.waitForTimeout(700);
  }
  await expect(choose).toBeVisible();
  await expect(page.getByText('EL MERCADER')).toBeVisible();
  await page.waitForTimeout(1800);
  await shot(page, info, 'mercader');
  await page.locator('[aria-label^="boon"]').first().click({ force: true });
  await page.waitForFunction(() => (window as unknown as G).__game.getState().castle?.stage === 1);
  await page.waitForTimeout(1200);
  await shot(page, info, 'piso-2');
  noErrors();
});

test('dorsos: la galería y ponerse uno ganado', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await seed(page, { magic_poker_progress: { defeated: 12, wins: { wall: 5, sovereign: 5, duelist: 3 } } });
  await page.locator('[aria-label=collection]').click({ force: true });
  await page.getByText('Dorsos', { exact: true }).click({ force: true });
  await page.waitForTimeout(400);
  await shot(page, info, 'galeria');
  await page.locator('[aria-label="back sovereign"]').click({ force: true });
  expect(await page.evaluate(() => localStorage.getItem('magic_poker_back'))).toBe('sovereign');
  // Uno sin ganar no se puede poner
  await expect(page.locator('[aria-label="back duelist"]')).toBeDisabled();
  noErrors();
});

test('cartas del Castillo: la bomba estalla y la torre frena', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await startScenario(page, {
    player: { board: [card('player', 'TOWER', 't'), card('player', 'BOMB', 'b')] },
    opponent: { board: [card('opponent', 'K', 'k'), card('opponent', '9', 'n'), null] },
  });
  await shot(page, info, 'antes');
  await fight(page);
  await filmFight(page, info, 'pelea', 6);
  await waitFought(page);
  const s = await state(page);
  // La bomba cae ante el 9 y estalla: mata al Rey (hueco 0) y golpea el hueco 2 vacío.
  // El Rey, además, chocó contra la Torre.
  expect(s.result!.deadCardIds).toEqual(expect.arrayContaining(['player-BOMB-b', 'opponent-K-k']));
  noErrors();
});

test('comodín de sello: se elige el sello al jugarlo', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  const wild = { ...sealCard('player', 'shield', 'w'), id: 'player-SEAL-wild-w', seal: undefined, wild: true };
  await startScenario(page, {
    player: { board: [card('player', '7', 'a')], hand: [wild] },
    opponent: { board: [] },
  });
  // Se arrastra el comodín de la mano a la carta de la mesa (cuando ya ha llegado a la mano)
  await page.waitForTimeout(1500);
  const from = (await page.locator('[data-hand-card="player-SEAL-wild-w"]').boundingBox())!;
  const to = (await page.locator('[data-card="player-7-a"]').boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(from.x + (to.x - from.x) * i / 12 + from.width / 2, from.y + (to.y - from.y) * i / 12 + to.height / 2 * (i / 12));
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);
  await expect(page.getByText('¿Qué sello será?')).toBeVisible();
  await shot(page, info, 'elegir');
  await page.locator('[aria-label="wild mirror"]').click({ force: true });
  const s = await state(page);
  expect(s.player.board[0].card?.seal).toBe('mirror');
  noErrors();
});

test('lo del mercader va en azul: cartas nuevas, mejoradas y vidas de más', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await startScenario(page, {
    player: {
      lives: 6,
      board: [card('player', 'KNIGHT', 'm1', { merchant: true }), card('player', '7', 'm2', { merchant: true, bonus: 2, value: 9 }), card('player', '5', 'n1')],
      hand: [card('player', 'TOWER', 'm3', { merchant: true }), { ...sealCard('player', 'shield', 'm4'), seal: undefined, wild: true, merchant: true }],
    },
    opponent: { board: [] },
  });
  await page.waitForTimeout(1500);
  await expect(page.locator('[data-card]').first()).toBeVisible();
  await shot(page, info, 'mercader-en-mesa');
  noErrors();
});
