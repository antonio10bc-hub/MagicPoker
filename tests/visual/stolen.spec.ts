import { test } from '@playwright/test';
import { card, shot, startScenario, watchErrors } from './helpers';

// --- CARTA ROBADA CON SELLO ---
// El dorso de su dueño va a la izquierda; el sello, a la derecha: no se pisan.
test('carta robada con sello: el dorso y el sello no se solapan', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await startScenario(page, {
    player: { board: [card('player', '8', 'a'), card('player', 'Q', 'q', { seal: 'shield' }), card('player', '6', 'b'), card('player', '2', 'c')] },
    opponent: { board: [null, card('player', '5', 's', { isFaceUp: true, seal: 'shield' }), null, null] },
  });
  await page.waitForTimeout(2500);
  await shot(page, info, 'robada-con-sello');
  noErrors();
});
