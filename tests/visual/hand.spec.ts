import { expect, Page, test } from '@playwright/test';
import { card, sealCard, startScenario, watchErrors } from './helpers';

// --- LA MANO: COGER CARTAS ---
// Jugar una carta arrastrándola no deja restos en la mano que se coman los clics de las
// demás, y una carta que no se puede jugar (sello sin carta tuya donde ponerlo) no se
// queda seleccionada.

type G = { __game: { getState: () => { player: { hand: { id: string }[] } } } };

/** Cartas de la mano en pantalla que ya no están en la mano del juego */
const ghosts = (page: Page) => page.evaluate(() => {
  const inHand = new Set((window as unknown as G).__game.getState().player.hand.map(c => c.id));
  return [...document.querySelectorAll<HTMLElement>('[data-hand-card]')].map(el => el.dataset.handCard!).filter(id => !inHand.has(id));
});

/** Para cada carta de la mano: quién recibe el puntero a la izquierda, en el centro y a la derecha */
const hits = (page: Page) => page.evaluate(() =>
  [...document.querySelectorAll<HTMLElement>('[data-hand-card]')].map(el => {
    const r = el.getBoundingClientRect();
    return [0.2, 0.5, 0.8].every(f => document.elementFromPoint(r.left + r.width * f, r.top + r.height / 2)?.closest('[data-hand-card]') === el);
  }));

test('jugar arrastrando no deja cartas fantasma que tapen la mano', async ({ page }) => {
  const noErrors = watchErrors(page);
  await startScenario(page, {
    player: { board: [card('player', '5', 'b1'), null, null, null], hand: [card('player', '9', 'h1'), card('player', '4', 'h2'), card('player', '8', 'h3')] },
    opponent: { board: [null, null, null, null] },
  });
  await page.waitForTimeout(1500);
  const b = (await page.locator('[data-hand-card]').nth(1).boundingBox())!;
  const slot = await page.evaluate(() => { const r = document.querySelector('[data-card]')!.getBoundingClientRect(); return { x: r.left + r.width * 2.7, y: r.top + r.height / 2 }; });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(slot.x, slot.y, { steps: 15 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => (window as unknown as G).__game.getState().player.hand.length)).toBe(2);
  await page.waitForTimeout(1200);
  expect(await ghosts(page)).toEqual([]);
  expect(await hits(page)).toEqual([true, true]);
  noErrors();
});

test('un sello sin carta tuya donde ponerlo no se selecciona; una carta normal sí', async ({ page }) => {
  const noErrors = watchErrors(page);
  await startScenario(page, {
    player: { board: [null, null, null, null], hand: [sealCard('player', 'shield', 's1'), card('player', '6', 'h1')] },
    opponent: { board: [null, null, null, null] },
  });
  await page.waitForTimeout(1500);
  const cards = page.locator('[data-hand-card]');
  await cards.nth(0).click();
  await page.waitForTimeout(300);
  await expect(cards.nth(0).locator('.card-glow')).toHaveCount(0);
  await cards.nth(1).click();
  await page.waitForTimeout(300);
  await expect(cards.nth(1).locator('.card-glow')).toHaveCount(1);
  expect(await page.locator('[data-slot]').count()).toBe(4);
  noErrors();
});
