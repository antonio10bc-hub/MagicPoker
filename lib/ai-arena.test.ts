import { describe, expect, it } from 'vitest';
import { Difficulty, PlayerState, Rng } from '@/types';
import {
  applyPreCombatSeals, calculateCombat, clearDefeatedCards, createDeck, createPlayerState, drawCards, lifeGains, markCombatResult, playCardToSlot,
} from '@/lib/game-utils';
import { chooseOpponentMove } from '@/lib/ai';
import { CARDS_DRAWN_PER_ROUND, STARTING_HAND_SIZE, STARTING_LIVES } from '@/lib/constants';

// --- ARENA: la IA contra la IA, con las reglas de verdad ---
// Partidas enteras simplificadas (mazo estándar, sin sellos): por turnos ponen cartas
// hasta que los dos se plantan, pelea, se reparten daños y se roba. Sirve para ver que
// la IA que piensa gana claramente a la de antes (al azar) y que "difícil" > "normal".

const seeded = (seed: number): Rng => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

/** Una partida: devuelve quién gana ('a', 'b' o 'draw') */
const play = (a: Difficulty, b: Difficulty, rng: Rng): 'a' | 'b' | 'draw' => {
  const shuffled = (owner: 'player' | 'opponent') => createDeck(owner).map(c => ({ c, k: rng() })).sort((x, y) => x.k - y.k).map(x => x.c);
  let A: PlayerState = createPlayerState(shuffled('player'), STARTING_HAND_SIZE, true, STARTING_LIVES);
  let B: PlayerState = createPlayerState(shuffled('opponent'), STARTING_HAND_SIZE, false, STARTING_LIVES);
  for (let round = 0; round < 40; round++) {
    let aPassed = false, bPassed = false;
    for (let turn = 0; turn < 20 && !(aPassed && bPassed); turn++) {
      if (!aPassed) {
        const m = chooseOpponentMove(A.hand, A.board, B.board, a, rng, { lives: A.lives, playerLives: B.lives, playerPassed: bPassed });
        const next = m && playCardToSlot(A, m.cardId, m.slotIndex, true);
        if (next) A = next; else aPassed = true;
      }
      if (!bPassed) {
        const m = chooseOpponentMove(B.hand, B.board, A.board, b, rng, { lives: B.lives, playerLives: A.lives, playerPassed: aPassed });
        const next = m && playCardToSlot(B, m.cardId, m.slotIndex, true);
        if (next) B = next; else bPassed = true;
      }
    }
    const pre = applyPreCombatSeals(A.board, B.board);
    const r = calculateCombat(pre.player, pre.opponent, rng);
    const aBoard = markCombatResult(pre.player, r);
    const bBoard = markCombatResult(pre.opponent, r);
    A = { ...A, lives: Math.min(STARTING_LIVES, A.lives - r.playerDamageTaken + lifeGains(aBoard, r)), board: clearDefeatedCards(aBoard) };
    B = { ...B, lives: Math.min(STARTING_LIVES, B.lives - r.opponentDamageTaken + lifeGains(bBoard, r)), board: clearDefeatedCards(bBoard) };
    if (A.lives <= 0 || B.lives <= 0) return A.lives > 0 ? 'a' : B.lives > 0 ? 'b' : 'draw';
    A = drawCards(A, CARDS_DRAWN_PER_ROUND, true);
    B = drawCards(B, CARDS_DRAWN_PER_ROUND, false);
  }
  return 'draw';
};

const winRate = (a: Difficulty, b: Difficulty, games: number) => {
  const rng = seeded(7);
  let wins = 0, decided = 0;
  for (let g = 0; g < games; g++) {
    // Se alternan los papeles (quién va primero)
    const r = g % 2 ? play(b, a, rng) : play(a, b, rng);
    const aWon = g % 2 ? r === 'b' : r === 'a';
    const bWon = g % 2 ? r === 'a' : r === 'b';
    if (aWon) wins++;
    if (aWon || bWon) decided++;
  }
  return wins / Math.max(1, decided);
};

describe('arena de IA', () => {
  it('la IA que piensa (difícil) gana claramente a la de antes (al azar)', () => {
    expect(winRate('hard', 'easy', 300)).toBeGreaterThan(0.75);
  });

  it('difícil gana más que normal', () => {
    expect(winRate('hard', 'normal', 300)).toBeGreaterThan(0.55);
  });
});
