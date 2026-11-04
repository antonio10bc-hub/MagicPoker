import { expect, Page, test } from '@playwright/test';
import { shot, watchErrors } from './helpers';

// --- EN INGLÉS ---
// Con el idioma en inglés (Ajustes → Language), ningún texto a la vista queda en castellano:
// menú, cada ventana, una partida, el Castillo y el Bosque. Y el cambio de idioma desde
// Ajustes se aplica al momento.

/** Palabras que solo salen en castellano (en mayúsculas o no) */
const SPANISH = /\b(el|la|los|las|del|que|tu|tus|con|por|para|una|jefe|partida|cartas?|vidas?|ronda|rival es|ajustes|jugar|desafiar|seguir|volver|salir|bosque|castillo|sello|sellos|logros?|victorias?|derrotas?|racha|mazo)\b|[áéíóúñ¿¡]/i;

const spanishOnScreen = (page: Page) => page.evaluate((src) => {
  const re = new RegExp(src, 'i');
  const out: string[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const txt = n.textContent?.trim();
    const el = n.parentElement;
    if (!txt || !el || !el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true })) continue;
    if (re.test(txt) && txt !== 'Español') out.push(txt);
  }
  return out;
}, SPANISH.source);

const seed = (page: Page, extra: Record<string, string> = {}) => page.addInitScript((more) => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.clear();
  localStorage.setItem('has_played_before', 'true'); localStorage.setItem('magic_poker_tutorial_done', '1'); localStorage.setItem('magic_poker_prologue', 'done');
  localStorage.setItem('magic_poker_settings', JSON.stringify({ grain: 'off', quality: 'high', music: 0, sfx: 0, lang: 'en' }));
  localStorage.setItem('magic_poker_progress', JSON.stringify({ defeated: 12 })); localStorage.setItem('magic_poker_map_seen', '12'); localStorage.setItem('magic_poker_forest_seen', '1');
  localStorage.setItem('magic_poker_ente_return', '1');
  localStorage.setItem('magic_poker_castle', JSON.stringify({ run: null, best: 12, conquered: 1 }));
  localStorage.setItem('magic_poker_forest', JSON.stringify({ duels: 40, streak: 2, bestStreak: 6, marks: 30, bestMarks: 30, seen: {} }));
  for (const [k, v] of Object.entries(more)) localStorage.setItem(k, v);
}, extra);

const openModal = (page: Page, name: string) => page.evaluate(m => (window as unknown as { __ui: { getState: () => { openModal: (n: string) => void } } }).__ui.getState().openModal(m), name);
const closeModal = (page: Page) => page.evaluate(() => (window as unknown as { __ui: { getState: () => { closeModal: () => void } } }).__ui.getState().closeModal());

test('en inglés: el menú y todas las ventanas sin una palabra en castellano', async ({ page }, info) => {
  test.setTimeout(120_000);
  const noErrors = watchErrors(page);
  await seed(page);
  await page.goto('/');
  await expect(page.getByLabel('forest', { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
  await shot(page, info, 'en-menu');
  const found: Record<string, string[]> = {};
  const check = async (where: string) => {
    const words = await spanishOnScreen(page);
    if (words.length) found[where] = words;
  };
  await check('menu');
  for (const m of ['settings', 'rules', 'stats', 'collection', 'deck', 'challenges', 'bestiary', 'backup']) {
    await openModal(page, m);
    await page.waitForTimeout(700);
    await shot(page, info, `en-${m}`);
    await check(m);
    await closeModal(page);
    await page.waitForTimeout(300);
  }
  // El Bosque
  await page.getByLabel('forest', { exact: true }).click({ force: true });
  await page.waitForTimeout(1500);
  await shot(page, info, 'en-forest');
  await check('forest');
  expect(found).toEqual({});
  noErrors();
});

test('en inglés: una partida contra un jefe', async ({ page }, info) => {
  test.setTimeout(90_000);
  const noErrors = watchErrors(page);
  await seed(page, { magic_poker_progress: JSON.stringify({ defeated: 3 }), magic_poker_map_seen: '3' });
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as { __game?: unknown }).__game);
  await page.waitForTimeout(1500);
  await page.evaluate(() => (window as unknown as { __game: { getState: () => { startGame: (...a: unknown[]) => void } } }).__game.getState().startGame());
  await page.waitForTimeout(4000);
  await shot(page, info, 'en-game');
  const words = await spanishOnScreen(page);
  expect(words).toEqual([]);
  noErrors();
});

test('idioma: se cambia desde Ajustes al momento', async ({ page }) => {
  await seed(page, { magic_poker_settings: JSON.stringify({ grain: 'off', quality: 'high', music: 0, sfx: 0, lang: 'es' }) });
  await page.goto('/');
  await expect(page.getByLabel('forest', { exact: true })).toBeVisible({ timeout: 15_000 });
  await openModal(page, 'settings');
  await page.getByText('English', { exact: true }).click();
  await expect(page.getByText('Language', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('magic_poker_settings') ?? '{}').lang)).toBe('en');
  await page.getByText('Español', { exact: true }).click();
  await expect(page.getByText('Idioma', { exact: true })).toBeVisible();
});
