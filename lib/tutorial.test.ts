import { describe, expect, it } from 'vitest';
import { PlayerState } from '@/types';
import {
  calculateCombat, clearDefeatedCards, countRankOnBoard, drawCards, getGameResult, markCombatResult, playCardToSlot, revealBoard,
} from '@/lib/game-utils';
import { CARDS_DRAWN_PER_ROUND, JOKER_DRAW_BONUS } from '@/lib/constants';
import { forecastFight } from '@/components/game/forecast';
import { applyRivalMoves, stepCard, TUTORIAL_OPENINGS, TUTORIAL_STEPS, tutorialPlayers, tutorialRng } from '@/lib/tutorial';

/** Reproduce el flujo de la tienda con el guion del tutorial */
const playTutorial = () => {
  let { player, opponent } = tutorialPlayers();
  let round = 1;
  const lives: [number, number][] = [];
  let result: ReturnType<typeof getGameResult> = null;
  let dangerAtRound3 = false;

  for (const step of TUTORIAL_STEPS) {
    if (step.kind === 'play') {
      const card = stepCard(player.hand, step);
      expect(card, `paso ${step.text}: falta ${step.rank} en la mano`).toBeDefined();
      const next = playCardToSlot(player, card!.id, step.slot, true);
      expect(next, `paso ${step.text}: hueco ${step.slot} ocupado`).not.toBeNull();
      player = next!;
      opponent = applyRivalMoves(opponent, step.rival);
    }
    if (step.kind === 'stand') {
      opponent = applyRivalMoves(opponent, step.rival);
      // Pelea: se revela, los Jokers roban, se resuelve
      opponent = { ...opponent, board: revealBoard(opponent.board) };
      player = drawCards(player, countRankOnBoard(player.board, 'JOKER') * JOKER_DRAW_BONUS, true);
      const combat = calculateCombat(player.board, opponent.board, tutorialRng(player.board, round));
      player = { ...player, lives: Math.max(0, player.lives - combat.playerDamageTaken), board: clearDefeatedCards(markCombatResult(player.board, combat)) };
      opponent = { ...opponent, lives: Math.max(0, opponent.lives - combat.opponentDamageTaken), board: clearDefeatedCards(markCombatResult(opponent.board, combat)) };
      lives.push([player.lives, opponent.lives]);
      result = getGameResult(player, opponent);
      if (result) break;
      round++;
      player = drawCards(player, CARDS_DRAWN_PER_ROUND, true);
      opponent = applyRivalMoves(drawCards(opponent, CARDS_DRAWN_PER_ROUND, false), TUTORIAL_OPENINGS[round]);
      if (round === 3) {
        // Rey y Reina a la vista: lo que se ve basta para acabar contigo (¡PELIGRO!)
        const { taken } = forecastFight(player.board, opponent.board);
        dangerAtRound3 = taken.sure + taken.maybe >= player.lives;
      }
    }
  }
  return { lives, result, dangerAtRound3, player: player as PlayerState };
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
    expect(TUTORIAL_STEPS.filter(s => s.kind === 'stand')).toHaveLength(4);
    // La última pelea no tiene repaso: la cuenta la pantalla final
    expect(TUTORIAL_STEPS.filter(s => s.kind === 'review')).toHaveLength(3);
    expect(TUTORIAL_STEPS).toHaveLength(13);
  });
});
