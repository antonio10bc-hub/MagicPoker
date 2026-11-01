import { expect, Page, test } from '@playwright/test';
import { shot, watchErrors } from './helpers';

// --- PRÓLOGO: el paseo con el ente ---
// El claro (humo → tocar → el ente habla → SEGUIR), las seis paradas con su lección de un
// turno (JUGAR), el duelo (ENFRENTARSE) y la despedida que abre el camino al Forastero.
type St = {
  screen: string; phase: string; turn: string; tutorialStep: number | null; tutorialId: string;
  player: { hand: { id: string; rank: string }[]; lives: number };
  placeCard: (id: string, slot: number) => void; passTurn: () => void; finishCombatPhase: () => void;
};
type W = { __game: { getState: () => St } };

/** Espera a que toque jugar (paso `step`) o a la pelea */
const ready = (page: Page, step: number, phase = 'placement') => page.waitForFunction(([st, ph]) => {
  const s = (window as unknown as W).__game.getState();
  return s.tutorialStep === st && s.phase === ph && (ph !== 'placement' || s.turn === 'player');
}, [step, phase] as const, { timeout: 20_000 });
const play = (page: Page, rank: string, slot: number) => page.evaluate(([r, sl]) => {
  const s = (window as unknown as W).__game.getState();
  s.placeCard(s.player.hand.find(c => c.rank === r)!.id, sl as number);
}, [rank, slot] as const);
const call = (page: Page, fn: 'passTurn' | 'finishCombatPhase') => page.evaluate(f => (window as unknown as W).__game.getState()[f](), fn);
/** La acción principal del menú, cuando el ente ha terminado de hablar */
const cta = async (page: Page, title: string) => {
  const b = page.locator('button', { has: page.getByText(title, { exact: true }) });
  await expect(b).toBeEnabled({ timeout: 25_000 });
  await page.waitForTimeout(700);
  await b.click({ force: true });
};

const LESSONS: [string, number][] = [['6', 1], ['J', 1], ['Q', 1], ['K', 1], ['JOKER', 1], ['A', 3]];

test('prólogo: el paseo con el ente, sus lecciones, el duelo y el camino al Forastero', async ({ page }, info) => {
  test.setTimeout(240_000);
  const noErrors = watchErrors(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('magic_poker_settings', JSON.stringify({ grain: 'off', quality: 'high', music: 0, sfx: 0 }));
  });
  await page.goto('/');
  // El claro: humo y aviso de tocar; hasta hacer el tutorial, solo ajustes
  await expect(page.getByText(/^(TOCA|HAZ CLIC)$/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel('reglas')).toHaveCount(0);
  await expect(page.getByLabel('estadísticas')).toHaveCount(0);
  await page.waitForTimeout(1200);
  await shot(page, info, '01-humo');
  await page.getByLabel('map reveal').click();
  await expect(page.getByText(/te enseñaré a sobrevivir\.$/).last()).toBeVisible({ timeout: 15_000 });
  await shot(page, info, '02-ente');
  await cta(page, 'SEGUIR');

  // Las seis paradas: el ente llega, se desvela su carta, habla y se juega en un turno
  for (const [i, [rank, slot]] of LESSONS.entries()) {
    await cta(page, 'ESCUCHAR');
    if (i === 0) await shot(page, info, '03-parada-6');
    await ready(page, 0);
    await page.waitForTimeout(600);
    if (i === 0) await shot(page, info, '04-leccion-6');
    await play(page, rank, slot);
    await ready(page, 1);
    await call(page, 'passTurn');
    await ready(page, 2, 'combat-reveal');
    await page.waitForTimeout(1800);
    await shot(page, info, `05-repaso-${rank}`);
    await call(page, 'finishCombatPhase');
    await page.waitForFunction(() => (window as unknown as W).__game.getState().screen === 'menu');
  }

  // El duelo
  await cta(page, 'ENFRENTARSE');
  await shot(page, info, '06-duelo');
  await ready(page, 0); await play(page, '9', 1);
  await ready(page, 1); await play(page, '7', 3);
  await ready(page, 2); await call(page, 'passTurn');
  await ready(page, 3, 'combat-reveal'); await page.waitForTimeout(1500); await call(page, 'finishCombatPhase');
  // Y libre: lo cierras tú. Se juega con la interfaz de verdad: tocar carta y hueco
  await ready(page, 4);
  await page.waitForTimeout(600);
  await expect(page.getByText('Ahora tú solo. Acaba conmigo.')).toBeVisible();
  await shot(page, info, '06b-libre');
  const emptySlot = await page.evaluate(() => (window as unknown as { __game: { getState: () => { player: { board: { card: unknown }[] } } } }).__game.getState().player.board.findIndex(b => !b.card));
  await page.locator('[data-hand-card]').first().click();
  await page.locator(`[data-slot="${emptySlot}"]`).click();
  await page.waitForFunction(i => !!(window as unknown as { __game: { getState: () => { player: { board: { card: unknown }[] } } } }).__game.getState().player.board[i as number].card, emptySlot);
  // Al plantarse, el cartel ya no vuelve
  await page.waitForFunction(() => (window as unknown as W).__game.getState().turn === 'player', undefined, { timeout: 10_000 });
  await call(page, 'passTurn');
  await expect(page.getByText('Ahora tú solo. Acaba conmigo.')).toHaveCount(0);
  for (let turn = 0; turn < 12; turn++) {
    const done = await page.evaluate(() => {
      const s = (window as unknown as { __game: { getState: () => St & { player: { board: { card: unknown }[] } } } }).__game.getState();
      if (s.screen !== 'game' || s.phase === 'end') return true;
      if (s.phase === 'combat-reveal') { s.finishCombatPhase(); return false; }
      if (s.phase !== 'placement' || s.turn !== 'player') return false;
      const empty = s.player.board.findIndex(b => !b.card);
      const card = s.player.hand[0];
      if (card && empty >= 0) s.placeCard(card.id, empty);
      else s.passTurn();
      return false;
    });
    if (done) break;
    await page.waitForTimeout(1800);
  }
  const back = page.getByText('VOLVER AL CAMINO', { exact: true });
  await back.waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1200);
  await shot(page, info, '07-fin-duelo');
  await back.click({ force: true });

  // La despedida y el camino hasta el Forastero
  await expect(page.getByText(/Mucha suerte, extraño\.$/).last()).toBeVisible({ timeout: 15_000 });
  await shot(page, info, '08-despedida');
  await expect(page.locator('button', { has: page.getByText('¡DESAFIAR!', { exact: true }) })).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByLabel('reglas')).toHaveCount(1);
  await page.waitForTimeout(800);
  await shot(page, info, '09-forastero');
  expect(await page.evaluate(() => localStorage.getItem('magic_poker_prologue'))).toBe('done');
  // Al volver, ya no se repite
  await page.reload();
  await expect(page.getByText('¡DESAFIAR!')).toBeVisible({ timeout: 10_000 });
  noErrors();
});
