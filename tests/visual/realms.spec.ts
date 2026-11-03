import { expect, test } from '@playwright/test';
import { shot, watchErrors } from './helpers';

// --- LOS REINOS DEL BOSQUE ---
// Con la marca alta, a los lados del bosque salen los ojos de los reinos; al tocarlos la
// vista gira y allí solo sale gente de esa dificultad.
test('reinos: se abren con la marca, la vista gira y en cada uno solo sale su dificultad', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('has_played_before', 'true'); localStorage.setItem('magic_poker_tutorial_done', '1'); localStorage.setItem('magic_poker_prologue', 'done');
    localStorage.setItem('magic_poker_settings', JSON.stringify({ grain: 'off', quality: 'high', music: 0, sfx: 0 }));
    localStorage.setItem('magic_poker_progress', JSON.stringify({ defeated: 12 })); localStorage.setItem('magic_poker_map_seen', '12'); localStorage.setItem('magic_poker_forest_seen', '1');
    localStorage.setItem('magic_poker_castle', JSON.stringify({ run: null, best: 12, conquered: 1 }));
    localStorage.setItem('magic_poker_forest', JSON.stringify({ duels: 40, streak: 0, bestStreak: 3, marks: 61, bestMarks: 61, seen: {} }));
  });
  await page.goto('/');
  await page.getByLabel('forest', { exact: true }).click({ force: true });
  // Pesadillas y únicos abiertos; renegados todavía no
  await expect(page.getByLabel('realm nightmare')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel('realm unique')).toBeVisible();
  await page.getByLabel('realm nightmare').click();
  await expect(page.getByText('PESADILLAS', { exact: true })).toBeVisible();
  await expect(page.getByLabel('realm renegade')).toHaveCount(0);
  await page.waitForTimeout(1200);
  await shot(page, info, 'pesadillas');
  await page.getByText('BUSCAR DUELO').click({ force: true });
  await expect(page.getByText('PESADILLA', { exact: true })).toBeVisible({ timeout: 5_000 });
  noErrors();
});
