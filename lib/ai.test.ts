import { describe, expect, it } from 'vitest';
import { BoardSlot, Card, Difficulty, Owner, Rank } from '@/types';
import { createEmptyBoard, RANKS } from '@/lib/game-utils';
import { chooseOpponentMove } from '@/lib/ai';

const card = (rank: Rank, owner: Owner, id = `${owner}-${rank}`): Card => ({
  id, rank, owner, suit: rank === 'JOKER' ? 'joker' : 'standard', value: RANKS[rank].value, isFaceUp: owner === 'player',
});
const board = (owner: Owner, ranks: (Rank | null)[]): BoardSlot[] =>
  createEmptyBoard().map((slot, i) => ({ ...slot, card: ranks[i] ? card(ranks[i]!, owner, `${owner}-${i}`) : null }));
/** Azar fijo: siempre devuelve el mismo valor */
const fixed = (v: number) => () => v;

describe('opponent AI (estrategias)', () => {
  it('always plays the first card of its hand', () => {
    const move = chooseOpponentMove([card('3', 'opponent', 'a'), card('K', 'opponent', 'b')], board('opponent', [null, null, null, null]), board('player', [null, null, null, null]), 'easy', fixed(0));
    expect(move?.cardId).toBe('a');
  });

  it('easy picks uniformly among free slots', () => {
    const free = board('opponent', ['2', null, '3', null]);
    const empty = board('player', [null, null, null, null]);
    expect(chooseOpponentMove([card('5', 'opponent')], free, empty, 'easy', fixed(0))?.slotIndex).toBe(1);
    expect(chooseOpponentMove([card('5', 'opponent')], free, empty, 'easy', fixed(0.99))?.slotIndex).toBe(3);
  });

  it('normal defends (in front of your cards) only some of the time', () => {
    const free = board('opponent', [null, null, null, null]);
    const yours = board('player', [null, null, '9', null]);
    // Azar bajo (< 30 %): se pone delante de tu carta
    expect(chooseOpponentMove([card('5', 'opponent')], free, yours, 'normal', fixed(0.1))?.slotIndex).toBe(2);
    // Azar alto: cualquier hueco libre (el último con 0.99)
    expect(chooseOpponentMove([card('5', 'opponent')], free, yours, 'normal', fixed(0.99))?.slotIndex).toBe(3);
  });

  it('hard prefers a slot where it wins, then any defensive slot, then random', () => {
    const free = board('opponent', [null, null, null, null]);
    expect(chooseOpponentMove([card('8', 'opponent')], free, board('player', ['K', '5', null, null]), 'hard', fixed(0))?.slotIndex).toBe(1);
    // No gana a ninguna: se pone delante de alguna de tus cartas
    expect(chooseOpponentMove([card('2', 'opponent')], free, board('player', [null, 'K', null, null]), 'hard', fixed(0))?.slotIndex).toBe(1);
    // Tú no tienes cartas: al azar
    expect(chooseOpponentMove([card('2', 'opponent')], free, board('player', [null, null, null, null]), 'hard', fixed(0.99))?.slotIndex).toBe(3);
  });

  it('never picks an occupied slot, for every difficulty and any luck', () => {
    const own = board('opponent', ['2', null, '3', null]);
    const yours = board('player', ['K', '9', null, '4']);
    (['easy', 'normal', 'hard'] as Difficulty[]).forEach(d => {
      for (let r = 0; r < 1; r += 0.05) {
        const move = chooseOpponentMove([card('7', 'opponent')], own, yours, d, fixed(r));
        expect([1, 3]).toContain(move?.slotIndex);
      }
    });
  });
});

describe('el As del rival', () => {
  const c = (rank: Rank, owner: Owner, id: string, extra: Partial<Card> = {}): Card => ({ id, rank, owner, suit: 'standard', value: RANKS[rank].value, isFaceUp: true, ...extra });
  const boardOf = (owner: Owner, cards: (Card | null)[]): BoardSlot[] => createEmptyBoard().map((s, i) => ({ ...s, card: cards[i] ?? null }));
  const hand = [c('A', 'opponent', 'ace'), c('4', 'opponent', 'four')];
  const always = (n: number) => () => n;

  it('con una mesa ganadora (Rey con doble ataque y Reina) no se carga la suya: juega otra', () => {
    const mine = boardOf('opponent', [c('K', 'opponent', 'k', { seal: 'double' }), c('Q', 'opponent', 'q')]);
    const yours = boardOf('player', [c('3', 'player', 'p3')]);
    for (const n of [0, 0.5, 0.99]) expect(chooseOpponentMove(hand, mine, yours, 'hard', always(n))!.cardId).toBe('four');
  });

  it('si solo le queda el As y va ganando, se planta y lo guarda', () => {
    const mine = boardOf('opponent', [c('K', 'opponent', 'k'), c('Q', 'opponent', 'q')]);
    expect(chooseOpponentMove([c('A', 'opponent', 'ace')], mine, boardOf('player', []), 'hard', always(0.9))).toBeNull();
  });

  it('si vais parejos (Rey y Reina los dos) o tú vas mejor, lo usa', () => {
    const mine = boardOf('opponent', [c('K', 'opponent', 'k'), c('Q', 'opponent', 'q')]);
    const yours = boardOf('player', [c('K', 'player', 'pk'), c('Q', 'player', 'pq')]);
    expect(chooseOpponentMove(hand, mine, yours, 'hard', always(0.9))!.cardId).toBe('ace');
    expect(chooseOpponentMove(hand, boardOf('opponent', []), yours, 'hard', always(0.9))!.cardId).toBe('ace');
  });

  it('con poca ventaja a veces se arriesga (no es perfecto)', () => {
    const mine = boardOf('opponent', [c('9', 'opponent', 'n')]);
    const yours = boardOf('player', [c('5', 'player', 'p5')]);
    expect(chooseOpponentMove(hand, mine, yours, 'hard', always(0.1))!.cardId).toBe('ace');
    expect(chooseOpponentMove(hand, mine, yours, 'hard', always(0.9))!.cardId).toBe('four');
  });
});
