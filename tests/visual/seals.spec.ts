import { expect, test } from '@playwright/test';
import { card, filmFight, finish, fight, sealCard, shot, startScenario, state, waitPhase, watchErrors } from './helpers';

// --- PELEAS CON CADA SELLO ---
// Cada test prepara una mesa, juega la pelea, guarda capturas de la coreografía y
// comprueba el resultado en el estado del juego.

test('robo + ataque doble + defensa: la carta robada no vuelve a caer', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await startScenario(page, {
    player: { board: [card('player', '5', 'a', { seal: 'double' }), card('player', '7', 'b', { seal: 'shield' })] },
    opponent: { board: [card('opponent', 'K', 'c', { seal: 'swap' }), card('opponent', 'Q', 'd')] },
  });
  await shot(page, info, 'antes');
  await fight(page);
  // Tras el robo, la carta del 5 ya está en el lado rival: se marca su nodo para ver
  // que no se vuelve a montar (antes "caía" otra vez al cambiar el tablero)
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-card="player-K-c"], [data-card="opponent-K-c"]');
    return !!el && (window as unknown as { __game: { getState: () => { player: { board: { card: { id: string } | null }[] } } } }).__game.getState().player.board[0].card?.id === 'opponent-K-c';
  });
  await page.evaluate(() => document.querySelector('[data-card="player-5-a"]')?.setAttribute('data-mark', '1'));
  await filmFight(page, info, 'pelea');
  await waitPhase(page, 'combat-reveal');
  expect(await page.locator('[data-card="player-5-a"][data-mark="1"]').count()).toBe(1);
  const s = await state(page);
  expect(s.result!.shieldedIds).toContain('player-7-b');
  noErrors();
});

test('cambio y vida: se desliza al hueco de la derecha y recupera una vida', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await startScenario(page, {
    player: { lives: 2, board: [card('player', '5', 'a', { seal: 'shift' }), null, card('player', '7', 'b', { seal: 'life' })] },
    opponent: { board: [null, null, card('opponent', 'K', 'c')] },
  });
  await fight(page);
  await filmFight(page, info, 'pelea');
  await waitPhase(page, 'combat-reveal');
  let s = await state(page);
  expect(s.player.board[1].card?.id).toBe('player-5-a');
  await finish(page);
  s = await state(page);
  // El Rey mata al 5 y al 7 y golpea un hueco vacío (-1); el 7 con vida devuelve una
  expect(s.player.lives).toBe(2);
  await page.waitForTimeout(500);
  await shot(page, info, 'despues');
  noErrors();
});

test('espejo: devuelve el golpe y muere el atacante', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await startScenario(page, {
    player: { board: [null, card('player', '3', 'a', { seal: 'mirror' })] },
    opponent: { board: [null, card('opponent', '9', 'b')] },
  });
  await fight(page);
  await filmFight(page, info, 'pelea');
  await waitPhase(page, 'combat-reveal');
  const s = await state(page);
  expect(s.result!.deadCardIds).toEqual(['opponent-9-b']);
  expect(s.result!.reflected).toHaveLength(1);
  noErrors();
});

test('veneno: quien la mata cae con ella', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await startScenario(page, {
    player: { board: [card('player', '3', 'a', { seal: 'poison' })] },
    opponent: { board: [card('opponent', '9', 'b')] },
  });
  await fight(page);
  await filmFight(page, info, 'pelea');
  await waitPhase(page, 'combat-reveal');
  const s = await state(page);
  expect(s.result!.deadCardIds.sort()).toEqual(['opponent-9-b', 'player-3-a']);
  expect(s.result!.poisonedIds).toEqual(['opponent-9-b']);
  noErrors();
});

test('eco: al caer deja un 2', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await startScenario(page, {
    player: { board: [card('player', '5', 'a', { seal: 'echo' })] },
    opponent: { board: [card('opponent', '9', 'b')] },
  });
  await fight(page);
  await filmFight(page, info, 'pelea');
  await waitPhase(page, 'combat-reveal');
  await finish(page);
  const s = await state(page);
  expect(s.player.board[0].card?.rank).toBe('2');
  await page.waitForTimeout(600);
  await shot(page, info, 'despues');
  noErrors();
});

test('ancla: no te la pueden robar', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await startScenario(page, {
    player: { board: [card('player', '5', 'a', { seal: 'anchor' })] },
    opponent: { board: [card('opponent', '9', 'b', { seal: 'swap' })] },
  });
  await fight(page);
  await filmFight(page, info, 'pelea', 5);
  await waitPhase(page, 'combat-reveal');
  const s = await state(page);
  // Sin robo: el 9 rival mata a tu 5
  expect(s.result!.deadCardIds).toEqual(['player-5-a']);
  noErrors();
});

test('revelar: al ponerlo se da la vuelta la carta de enfrente y vale 1 menos', async ({ page }, info) => {
  const noErrors = watchErrors(page);
  await startScenario(page, {
    player: { board: [null, card('player', '8', 'a')], hand: [sealCard('player', 'reveal', 'r')] },
    opponent: { board: [null, card('opponent', '9', 'b', { isFaceUp: false })] },
  });
  await page.locator('[data-hand-card="player-SEAL-reveal-r"] div.cursor-pointer').first().click({ force: true });
  await page.locator('button[data-slot="1"]').click({ force: true });
  await page.waitForTimeout(700);
  await shot(page, info, 'revelada');
  let s = await state(page);
  expect(s.opponent.board[1].card).toMatchObject({ isFaceUp: true, isExposed: true });
  await fight(page);
  await filmFight(page, info, 'pelea', 5);
  await waitPhase(page, 'combat-reveal');
  s = await state(page);
  // Un 9 expuesto vale 8: empata con tu 8 y caen los dos
  expect(s.result!.deadCardIds.sort()).toEqual(['opponent-9-b', 'player-8-a']);
  noErrors();
});
