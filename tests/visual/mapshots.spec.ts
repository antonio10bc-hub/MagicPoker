import { Page, test } from '@playwright/test';
// --- RECORRIDO DEL MAPA ---
// Capturas del mapa entero, tramo a tramo, con todo descubierto (para revisar a ojo
// el terreno y los sitios de cada jefe)
const seed = async (page: Page, defeated: number) => {
  await page.addInitScript(d => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('has_played_before', 'true');
    localStorage.setItem('magic_poker_tutorial_done', '1');
    localStorage.setItem('magic_poker_settings', JSON.stringify({ grain: 'off', quality: 'high', music: 0, sfx: 0 }));
    localStorage.setItem('magic_poker_progress', JSON.stringify({ defeated: d }));
  }, defeated);
  await page.goto('/');
  await page.waitForTimeout(2200);
};
test('recorrido del mapa', async ({ page }, info) => {
  await seed(page, 12);
  const el = page.locator('.no-scrollbar').first();
  const h = await el.evaluate(e => e.scrollHeight);
  for (let i = 0; i < 7; i++) {
    await el.evaluate((e, y) => { e.scrollTop = y; }, h - (i + 1) * (h / 7));
    await page.waitForTimeout(500);
    await page.screenshot({ path: info.outputPath(`tramo-${i}.png`) });
  }
});
