import { expect, test } from '@playwright/test';
import { watchErrors } from './helpers';

// --- TUTORIAL: SALTAR PASO ---
// "Saltar paso" hace por ti el paso en el que estás (no se salta el tutorial entero).
type G = { getState: () => { tutorialStep: number | null; screen: string; startTutorial: (id: string) => void } };
const state = (page: import('@playwright/test').Page) =>
  page.evaluate(() => { const s = (window as unknown as { __game: G }).__game.getState(); return { step: s.tutorialStep, screen: s.screen }; });

test('saltar paso: avanza un paso cada vez, no acaba el tutorial', async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('magic_poker_settings', JSON.stringify({ grain: 'off', quality: 'high', music: 0, sfx: 0 }));
  });
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as { __game?: unknown }).__game);
  await page.evaluate(() => (window as unknown as { __game: G }).__game.getState().startTutorial('duel'));
  const skip = page.locator('[data-skip]');
  const seen: number[] = [];
  for (let i = 0; i < 12; i++) {
    const before = (await state(page)).step!;
    seen.push(before);
    // El botón del paso actual (el cartel del anterior tarda un instante en irse)
    const current = skip.filter({ hasText: `${before + 1}/` });
    await expect(current).toBeEnabled({ timeout: 20_000 });
    await current.click({ force: true });
    // Avanza al paso siguiente (o, en el tramo libre del final, termina)
    await page.waitForFunction(b => {
      const s = (window as unknown as { __game: G }).__game.getState();
      return s.tutorialStep === null || s.tutorialStep > b;
    }, before, { timeout: 20_000 });
    const now = await state(page);
    if (now.step === null) break;
  }
  // Pasó por varios pasos, uno a uno, y al final volvió al menú con el tutorial hecho
  expect(seen.length).toBeGreaterThan(3);
  expect(seen).toEqual([...seen].sort((a, b) => a - b));
  await expect.poll(async () => (await state(page)).screen, { timeout: 10_000 }).toBe('menu');
  expect(await page.evaluate(() => localStorage.getItem('magic_poker_tutorial_done'))).toBe('1');
  noErrors();
});
