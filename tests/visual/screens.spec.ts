import { expect, Page, test } from '@playwright/test';
import { card, shot, startScenario, watchErrors } from './helpers';

// --- MENÚ, VENTANAS Y PAUSA ---

/** Cierra la presentación del jefe (tocándola) si está a la vista */
const dismissIntro = async (page: Page) => {
  await page.waitForTimeout(700);
  const vp = page.viewportSize()!;
  await page.mouse.click(vp.width / 2, vp.height / 2);
  await page.waitForTimeout(400);
};

const openMenu = async (page: Page, progress: { defeated: number; rematches?: string[]; wins?: Record<string, number> }, extra: Record<string, string> = {}) => {
  await page.addInitScript((p: { progress: object; extra: Record<string, string> }) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('has_played_before', 'true');
    localStorage.setItem('magic_poker_tutorial_done', '1');
    localStorage.setItem('magic_poker_settings', JSON.stringify({ grain: 'off', music: 0, sfx: 0 }));
    localStorage.setItem('magic_poker_progress', JSON.stringify(p.progress));
    Object.entries(p.extra).forEach(([k, v]) => localStorage.setItem(k, v));
  }, { progress, extra });
  await page.goto('/');
  await page.waitForTimeout(1800);
};

/** Número de páginas del carrusel de bosses (los puntos de abajo) */
const bossPages = (page: Page) => page.locator('[aria-label^="map boss "]').count();

test('el jefe secreto no sale hasta vencer a los demás', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await openMenu(page, { defeated: 10 });
  expect(await bossPages(page)).toBe(11);
  await shot(page, info, 'menu-sin-secreto');
  await page.evaluate(() => localStorage.setItem('magic_poker_progress', JSON.stringify({ defeated: 11 })));
  await page.reload();
  // El mapa lo cuenta por fases (jefe secreto activado) y luego lo deja en su sitio
  await expect(page.locator('[aria-label="map boss 12"]')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('[aria-label="map reveal"]')).toHaveCount(0, { timeout: 6000 });
  expect(await bossPages(page)).toBe(12);
  await expect(page.getByText('JEFE SECRETO')).toBeVisible();
  await shot(page, info, 'menu-jefe-secreto');
  noErrors();
});

test('revancha: un solo botón REVANCHA con un jefe vencido', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await openMenu(page, { defeated: 3, rematches: ['wall'] });
  // Se elige El Muro (vencido) en el mapa
  await page.locator('[aria-label="map boss 2"]').click();
  await page.waitForTimeout(400);
  await expect(page.getByText('REVANCHA', { exact: true })).toBeVisible();
  await expect(page.getByText('nivel 2')).toBeVisible();
  await shot(page, info, 'menu-revancha');
  await page.getByText('REVANCHA', { exact: true }).click({ force: true });
  await page.waitForFunction(() => (window as unknown as { __game: { getState: () => { rematch: boolean } } }).__game.getState().rematch);
  await page.waitForTimeout(2500);
  await shot(page, info, 'partida-revancha');
  noErrors();
});

test('editor de mazo (con el primer sello)', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await openMenu(page, { defeated: 4 });
  await page.locator('[aria-label=mazo]').click({ force: true });
  await page.waitForTimeout(500);
  // Por defecto lleva un sello de cada uno desbloqueado (defensa, ataque y cambio)
  await page.locator('[aria-label="more shield"]').click({ force: true });
  await page.locator('[aria-label="remove K"]').click({ force: true });
  await page.locator('[aria-label="remove 2"]').click({ force: true });
  await expect(page.getByText('Tu mazo: 16 cartas')).toBeVisible();
  await shot(page, info, 'editor');
  // Se guarda en la ranura activa (Mazo 1)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('magic_poker_decks') ?? 'null')?.slots?.[0]);
  expect(saved.seals.shield).toBe(2);
  expect(saved.removed).toEqual(['K', '2']);
  noErrors();
});

test('catálogo de cartas desde ajustes', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await openMenu(page, { defeated: 2 });
  await page.locator('[aria-label=ajustes]').click({ force: true });
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
  await page.locator('[aria-label=pausa]').click();
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

test('x2: varias peleas seguidas sin atascarse y sin cartas fantasma', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await openMenu(page, { defeated: 4 });
  await page.getByText('¡DESAFIAR!', { exact: true }).click({ force: true });
  await page.waitForFunction(() => (window as unknown as { __game: { getState: () => { phase: string } } }).__game.getState().phase === 'placement');
  await dismissIntro(page);
  await page.locator('[aria-label=velocidad]').click();
  type G = { __game: { getState: () => { phase: string; turn: string; player: { hand: { id: string; rank: string }[]; board: { index: number; card: unknown }[] }; opponent: { board: { card: unknown }[] }; placeCard: (id: string, s: number) => void; passTurn: () => void } } };
  for (let round = 0; round < 3; round++) {
    // Juegas una carta y te plantas; la cuenta atrás de CONTINUAR cierra la pelea sola
    await page.evaluate(() => {
      const g = (window as unknown as G).__game.getState();
      const c = g.player.hand.find(x => x.rank !== 'SEAL');
      const f = g.player.board.find(s => !s.card);
      if (c && f) g.placeCard(c.id, f.index);
    });
    await page.waitForFunction(() => { const g = (window as unknown as G).__game.getState(); return (g.phase === 'placement' && g.turn === 'player') || g.phase === 'end'; }, undefined, { timeout: 15_000 });
    await page.evaluate(() => (window as unknown as G).__game.getState().passTurn());
    await page.waitForFunction(() => (window as unknown as G).__game.getState().phase === 'combat-reveal', undefined, { timeout: 15_000 });
    await page.waitForFunction(() => ['placement', 'end'].includes((window as unknown as G).__game.getState().phase), undefined, { timeout: 15_000 });
    if (await page.evaluate(() => (window as unknown as G).__game.getState().phase === 'end')) break;
    await page.waitForTimeout(800);
    // Las cartas caídas han salido de verdad de la mesa
    const counts = await page.evaluate(() => {
      const g = (window as unknown as G).__game.getState();
      return { dom: document.querySelectorAll('[data-card]').length, store: [...g.player.board, ...g.opponent.board].filter(s => s.card).length };
    });
    expect(counts.dom).toBe(counts.store);
    await shot(page, info, `ronda-${round}`);
  }
  noErrors();
});

test('al vencer a un jefe nuevo: AL MAPA, que enciende el siguiente, y a por él', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await openMenu(page, { defeated: 2 });
  await page.getByText('¡DESAFIAR!', { exact: true }).click({ force: true });
  type G = { __game: { getState: () => { phase: string; bossIndex: number; debugWin: () => void } } };
  await page.waitForFunction(() => (window as unknown as G).__game.getState().phase === 'placement');
  await page.evaluate(() => (window as unknown as G).__game.getState().debugWin());
  // Los avisos de desbloqueo y logros van antes: se cierran tocándolos
  const toMap = page.getByText('¡AL MAPA!');
  for (let i = 0; i < 12 && !(await toMap.isVisible()); i++) {
    const vp = page.viewportSize()!;
    await page.mouse.click(vp.width / 2, vp.height * 0.35);
    await page.waitForTimeout(700);
  }
  await expect(toMap).toBeVisible();
  await shot(page, info, 'victoria');
  await toMap.click({ force: true });
  // El mapa cuenta lo nuevo con el input bloqueado y luego devuelve el control
  await expect(page.locator('[aria-label="map reveal"]')).toBeAttached();
  await expect(page.locator('[aria-label="map reveal"]')).toHaveCount(0, { timeout: 14000 });
  await expect(page.getByText('¡DESAFIAR!', { exact: true })).toBeVisible();
  await shot(page, info, 'mapa-tras-victoria');
  await page.getByText('¡DESAFIAR!', { exact: true }).click({ force: true });
  await page.waitForFunction(() => (window as unknown as G).__game.getState().phase === 'placement');
  expect(await page.evaluate(() => (window as unknown as G).__game.getState().bossIndex)).toBe(3);
  noErrors();
});
