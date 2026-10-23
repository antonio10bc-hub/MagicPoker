import { expect, Page, test } from '@playwright/test';
import { shot, watchErrors } from './helpers';

// --- MAPA DE JEFES (menú) ---
// El camino vertical con los jefes, el Soberano y el Castillo ocultos hasta alcanzarlos,
// y las revelaciones por fases (input bloqueado hasta que terminan).

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

test('mapa: el camino hasta el jefe actual, con lo desconocido en la niebla', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await seed(page, { magic_poker_progress: { defeated: 3, wins: { drifter: 5, wall: 2, duelist: 1 } } });
  await shot(page, info, 'mapa-jefe-4');
  // Ni el Soberano ni el Castillo
  await expect(page.locator('[aria-label="map boss 12"]')).toHaveCount(0);
  await expect(page.locator('[aria-label="map castle"]')).toHaveCount(0);
  // Elegir un jefe vencido: revancha
  await page.locator('[aria-label="map boss 2"]').click();
  await expect(page.getByText('REVANCHA', { exact: true })).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, info, 'mapa-elegido');
  noErrors();
});

test('mapa: todo descubierto, con el Castillo arriba', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await seed(page, { magic_poker_progress: { defeated: 12 } });
  await expect(page.locator('[aria-label="map castle"]')).toBeVisible();
  await expect(page.getByText('ENTRAR')).toBeVisible();
  await shot(page, info, 'mapa-castillo');
  noErrors();
});

test('revelación: vencer a un jefe enciende el siguiente, por fases', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await seed(page, { magic_poker_progress: { defeated: 2 }, magic_poker_map_seen: 1 });
  // Input bloqueado mientras se cuenta
  await expect(page.locator('[aria-label="map reveal"]')).toBeAttached();
  await page.waitForTimeout(300);
  await shot(page, info, 'rev-1-foco');
  await page.waitForTimeout(1700);
  await shot(page, info, 'rev-2-se-desvanece');
  await page.waitForTimeout(1600);
  await shot(page, info, 'rev-3-bandera');
  await page.waitForTimeout(1300);
  await shot(page, info, 'rev-4-sendero');
  await page.waitForTimeout(2200);
  await shot(page, info, 'rev-5-nuevo');
  await expect(page.locator('[aria-label="map reveal"]')).toHaveCount(0, { timeout: 6000 });
  await expect(page.getByText('¡DESAFIAR!', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('magic_poker_map_seen'))).toBe('2');
  noErrors();
});

test('revelación: el jefe secreto despierta y cae a su sitio', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await seed(page, { magic_poker_progress: { defeated: 11 }, magic_poker_map_seen: 10 });
  await expect(page.locator('[aria-label="map boss 12"]')).toHaveCount(0);
  await page.waitForTimeout(6400);
  await shot(page, info, 'secreto-1-aviso');
  await page.waitForTimeout(3600);
  await shot(page, info, 'secreto-2-desciende');
  await page.waitForTimeout(2600);
  await shot(page, info, 'secreto-3-en-su-sitio');
  await expect(page.locator('[aria-label="map reveal"]')).toHaveCount(0, { timeout: 6000 });
  await expect(page.locator('[aria-label="map boss 12"]')).toBeVisible();
  await expect(page.getByText('JEFE SECRETO')).toBeVisible();
  noErrors();
});

test('revelación: tras el Soberano, el Castillo se alza', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await seed(page, { magic_poker_progress: { defeated: 12 }, magic_poker_map_seen: 11 });
  await expect(page.locator('[aria-label="map castle"]')).toHaveCount(0);
  await page.waitForTimeout(6400);
  await shot(page, info, 'castillo-1-aviso');
  await page.waitForTimeout(5200);
  await shot(page, info, 'castillo-2-emerge');
  await page.waitForTimeout(3000);
  await shot(page, info, 'castillo-3-listo');
  await expect(page.locator('[aria-label="map reveal"]')).toHaveCount(0, { timeout: 6000 });
  await expect(page.getByText('ENTRAR')).toBeVisible();
  noErrors();
});
