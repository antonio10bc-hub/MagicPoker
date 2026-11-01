import { describe, expect, it } from 'vitest';
import { PlayerState } from '@/types';
import {
  calculateCombat, clearDefeatedCards, countRankOnBoard, drawCards, getGameResult, markCombatResult, playCardToSlot, revealBoard,
} from '@/lib/game-utils';
import { CARDS_DRAWN_PER_ROUND, JOKER_DRAW_BONUS } from '@/lib/constants';
import { forecastFight } from '@/components/game/forecast';
import { applyRivalMoves, LESSONS, stepCard, stepsOf, TutorialId, tutorialOpening, tutorialPlayers, tutorialRng } from '@/lib/tutorial';

/** Reproduce el flujo de la tienda con el guion del tutorial */
const playTutorial = (id: TutorialId = 'full') => {
  let { player, opponent } = tutorialPlayers(id);
  let round = 1;
  const lives: [number, number][] = [];
  let result: ReturnType<typeof getGameResult> = null;
  let dangerAtRound3 = false;

  for (const step of stepsOf(id)) {
    if (step.kind === 'play') {
      const card = stepCard(player.hand, step);
      expect(card, `paso ${step.text}: falta ${step.rank} en la mano`).toBeDefined();
      // (sin hueco en el guion: el segundo, como haría cualquiera)
      const slot = step.slot ?? 1;
      const next = playCardToSlot(player, card!.id, slot, true);
      expect(next, `paso ${step.text}: hueco ${step.slot} ocupado`).not.toBeNull();
      player = next!;
      opponent = applyRivalMoves(opponent, step.rival, slot);
    }
    if (step.kind === 'stand') {
      opponent = applyRivalMoves(opponent, step.rival);
      // Pelea: se revela, los Jokers roban, se resuelve
      opponent = { ...opponent, board: revealBoard(opponent.board) };
      player = drawCards(player, countRankOnBoard(player.board, 'JOKER') * JOKER_DRAW_BONUS, true);
      const combat = calculateCombat(player.board, opponent.board, tutorialRng(player.board, round, id));
      player = { ...player, lives: Math.max(0, player.lives - combat.playerDamageTaken), board: clearDefeatedCards(markCombatResult(player.board, combat)) };
      opponent = { ...opponent, lives: Math.max(0, opponent.lives - combat.opponentDamageTaken), board: clearDefeatedCards(markCombatResult(opponent.board, combat)) };
      lives.push([player.lives, opponent.lives]);
      result = getGameResult(player, opponent);
      if (result) break;
      round++;
      player = drawCards(player, CARDS_DRAWN_PER_ROUND, true);
      opponent = applyRivalMoves(drawCards(opponent, CARDS_DRAWN_PER_ROUND, false), tutorialOpening(id, round));
      if (round === 3) {
        // Rey y Reina a la vista: lo que se ve basta para acabar contigo (¡PELIGRO!)
        const { taken } = forecastFight(player.board, opponent.board);
        dangerAtRound3 = taken.sure + taken.maybe >= player.lives;
      }
    }
  }
  return { lives, result, dangerAtRound3, player: player as PlayerState, opponent: opponent as PlayerState };
};

describe('tutorial', () => {
  it('follows the story: lose lives to empty slots, specials, the Ace saves you, you win', () => {
    const { lives, result, dangerAtRound3 } = playTutorial();
    expect(dangerAtRound3).toBe(true);
    // [tus vidas, vidas del rival] tras cada pelea
    expect(lives).toEqual([[2, 3], [2, 1], [2, 1], [2, 0]]);
    expect(result).toBe('win');
  });

  it('the review steps match the fights and every play step is reachable', () => {
    const TUTORIAL_STEPS = stepsOf('full');
    expect(TUTORIAL_STEPS.filter(s => s.kind === 'stand')).toHaveLength(4);
    // La última pelea no tiene repaso: la cuenta la pantalla final
    expect(TUTORIAL_STEPS.filter(s => s.kind === 'review')).toHaveLength(3);
    expect(TUTORIAL_STEPS.filter(s => s.kind === 'note')).toHaveLength(1);
    expect(TUTORIAL_STEPS).toHaveLength(14);
  });
  it('every prologue lesson is one turn that teaches its card (and its hits on your empty slots)', () => {
    // Tras la pelea de cada lección: lo que queda en cada mesa y tus vidas
    const expected: Record<string, { rivalLeft: number; mineLeft: number; lives: number }> = {
      number: { rivalLeft: 0, mineLeft: 1, lives: 4 }, // el 6 rompe al 4 (enfrente)
      jack: { rivalLeft: 0, mineLeft: 1, lives: 3 },   // el Príncipe va a por el 5… que te da a ti
      queen: { rivalLeft: 0, mineLeft: 1, lives: 2 },  // la Reina, los dos de los lados (y te dan)
      king: { rivalLeft: 0, mineLeft: 1, lives: 2 },   // el Rey, los tres (los de los lados te dan)
      joker: { rivalLeft: 1, mineLeft: 0, lives: 4 },  // el 5 se estrella contra el Joker: te cubre
      ace: { rivalLeft: 0, mineLeft: 0, lives: 4 },    // el As lo barre todo, también tu 9
    };
    for (const id of LESSONS) {
      const steps = stepsOf(id);
      expect(steps.filter(s => s.kind === 'stand'), id).toHaveLength(1);
      expect(steps[steps.length - 1].kind, id).toBe('review');
      const { lives, result, player, opponent } = playTutorial(id);
      expect(result, id).toBeNull();
      expect(lives[0][0], `${id}: tus vidas`).toBe(expected[id].lives);
      expect(opponent.board.filter(s => s.card).length, `${id}: mesa del rival`).toBe(expected[id].rivalLeft);
      expect(player.board.filter(s => s.card).length, `${id}: tu mesa`).toBe(expected[id].mineLeft);
    }
    // El Joker: al revelarse, 2 cartas más en la mano
    const joker = playTutorial('joker');
    expect(joker.player.hand.length).toBeGreaterThanOrEqual(2);
  });

  it('the duel against the spirit: a guided round (empty slots hurt), then free', () => {
    const steps = stepsOf('duel');
    expect(steps[steps.length - 1].kind).toBe('free');
    const { lives, result } = playTutorial('duel');
    // Tu 7 le quita una; sus 4 y 3 golpean tus 2 huecos vacíos. Lo demás lo juegas tú
    expect(lives).toEqual([[2, 1]]);
    expect(result).toBeNull();
  });
});
