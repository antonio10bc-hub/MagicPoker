import { expect, test } from '@playwright/test';
import { shot, watchErrors } from './helpers';

// --- VUELVE EL ENTE ---
// Con la última marca del Bosque (la de los renegados), al volver al menú el ente aparece
// en el bosque, dice sus cuatro silencios y se desvanece. Solo una vez.
test('última marca: el ente vuelve una vez, habla y se desvanece', async ({ page }, info) => {
  test.setTimeout(90_000);
  const noErrors = watchErrors(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('has_played_before', 'true'); localStorage.setItem('magic_poker_tutorial_done', '1'); localStorage.setItem('magic_poker_prologue', 'done');
    localStorage.setItem('magic_poker_settings', JSON.stringify({ grain: 'off', quality: 'high', music: 0, sfx: 0 }));
    localStorage.setItem('magic_poker_progress', JSON.stringify({ defeated: 12 })); localStorage.setItem('magic_poker_map_seen', '12'); localStorage.setItem('magic_poker_forest_seen', '1');
    localStorage.setItem('magic_poker_castle', JSON.stringify({ run: null, best: 12, conquered: 1 }));
    localStorage.setItem('magic_poker_forest', JSON.stringify({ duels: 140, streak: 0, bestStreak: 6, marks: 100, bestMarks: 100, seen: {} }));
  });
  await page.goto('/');
  const scene = page.getByLabel('ente return');
  await expect(scene).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(4500);
  await shot(page, info, 'ente-aparece');
  // (la frase, entera: el texto que se escribe letra a letra ya ha llegado al final)
  await expect(page.locator('span.absolute.inset-0', { hasText: /^Qué lejos has llegado\.\.\.$/ })).toBeVisible({ timeout: 20_000 });
  await shot(page, info, 'ente-habla');
  await expect(scene).toHaveCount(0, { timeout: 25_000 });
  await expect(page.getByLabel('forest', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('magic_poker_ente_return'))).toBe('1');
  // Al volver a entrar, ya no
  await page.reload();
  await expect(page.getByLabel('forest', { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  await expect(scene).toHaveCount(0);
  noErrors();
});
