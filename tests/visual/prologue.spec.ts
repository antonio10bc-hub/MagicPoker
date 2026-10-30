import { expect, test } from '@playwright/test';
import { shot, watchErrors } from './helpers';

// --- PRÓLOGO: el ente del claro, el tutorial y la despedida ---
type G = { __game: { getState: () => { screen: string; tutorialStep: number | null; debugWin: () => void } } };

test('prólogo: el ente habla, ESCUCHAR abre el tutorial y al volver se despide y abre el camino', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('magic_poker_settings', JSON.stringify({ grain: 'off', quality: 'high', music: 0, sfx: 0 }));
  });
  await page.goto('/');
  // Habla el ente y, al terminar, la acción es ESCUCHAR
  // (el bocadillo se escribe letra a letra: se espera a la frase entera)
  await expect(page.getByText(/te enseñaré a sobrevivir\.$/).last()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('ESCUCHAR')).toBeVisible();
  await page.waitForTimeout(800);
  await shot(page, info, 'ente');
  await page.getByText('ESCUCHAR').click({ force: true });
  await page.waitForFunction(() => (window as unknown as G).__game.getState().tutorialStep === 0);
  await shot(page, info, 'tutorial');
  // Se gana el tutorial: solo queda volver al menú
  await page.evaluate(() => (window as unknown as G).__game.getState().debugWin());
  const back = page.getByText(/volver al menú|salir al menú|menú/i).first();
  await back.waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  await shot(page, info, 'fin-tutorial');
  await back.click({ force: true });
  // La despedida y el camino hasta el Forastero
  await expect(page.getByText(/Mucha suerte, extraño\.$/).last()).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1500);
  await shot(page, info, 'despedida');
  await page.waitForTimeout(4200);
  await shot(page, info, 'camino');
  await expect(page.getByText('¡DESAFIAR!')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(800);
  await shot(page, info, 'forastero');
  expect(await page.evaluate(() => localStorage.getItem('magic_poker_prologue'))).toBe('done');
  // Al volver, ya no se repite
  await page.reload();
  await expect(page.getByText('¡DESAFIAR!')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/otra alma perdida/)).toHaveCount(0);
  noErrors();
});
