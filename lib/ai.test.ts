import { describe, expect, it } from 'vitest';
import { BoardSlot, Card, Difficulty, Owner, Rank } from '@/types';
import { createEmptyBoard, RANKS } from '@/lib/game-utils';
import { chooseOpponentMove, rankMoves } from '@/lib/ai';

const card = (rank: Rank, owner: Owner, id = `${owner}-${rank}`, extra: Partial<Card> = {}): Card => ({
  id, rank, owner, suit: rank === 'JOKER' ? 'joker' : 'standard', value: RANKS[rank].value, isFaceUp: true, ...extra,
});
const board = (owner: Owner, ranks: (Rank | null)[]): BoardSlot[] =>
  createEmptyBoard().map((slot, i) => ({ ...slot, card: ranks[i] ? card(ranks[i]!, owner, `${owner}-${i}`) : null }));
const boardOf = (cards: (Card | null)[]): BoardSlot[] => createEmptyBoard().map((s, i) => ({ ...s, card: cards[i] ?? null }));
/** Azar fijo: siempre devuelve el mismo valor */
const fixed = (v: number) => () => v;
const EMPTY = () => board('player', [null, null, null, null]);

describe('IA fácil (al azar, como siempre)', () => {
  it('juega su primera carta en un hueco libre cualquiera', () => {
    const free = board('opponent', ['2', null, '3', null]);
    expect(chooseOpponentMove([card('3', 'opponent', 'a'), card('K', 'opponent', 'b')], free, EMPTY(), 'easy', fixed(0))?.cardId).toBe('a');
    expect(chooseOpponentMove([card('5', 'opponent')], free, EMPTY(), 'easy', fixed(0))?.slotIndex).toBe(1);
    expect(chooseOpponentMove([card('5', 'opponent')], free, EMPTY(), 'easy', fixed(0.99))?.slotIndex).toBe(3);
  });
});

describe('IA que piensa (normal y difícil)', () => {
  it('pone su carta donde gana el choque y no donde la pierde', () => {
    const move = chooseOpponentMove([card('8', 'opponent')], board('opponent', [null, null, null, null]), board('player', ['K', '5', null, null]), 'hard', fixed(0));
    // Delante del 5 se lo lleva; delante del Rey caería
    expect(move?.slotIndex).toBe(1);
  });

  it('elige la carta justa: no gasta un 10 donde basta un 9', () => {
    const move = chooseOpponentMove([card('10', 'opponent', 'ten'), card('9', 'opponent', 'nine')], board('opponent', [null, null, null, null]), board('player', [null, null, '5', null]), 'hard', fixed(0));
    expect(move?.cardId).toBe('nine');
  });

  it('si puede acabar la partida, la acaba', () => {
    const ranked = rankMoves([card('9', 'opponent', 'a'), card('2', 'opponent', 'b')], board('opponent', [null, null, null, null]), board('player', [null, null, null, null]), { playerLives: 1 });
    expect(ranked[0].score).toBeGreaterThan(100);
  });

  it('tapa el golpe que le mataría', () => {
    // Tu 9 golpea su hueco vacío de delante y le queda 1 vida: se pone ahí (aunque caiga)
    const move = chooseOpponentMove([card('3', 'opponent')], board('opponent', [null, null, null, null]), board('player', [null, null, '9', null]), 'hard', fixed(0), { lives: 1 });
    expect(move?.slotIndex).toBe(2);
  });

  it('en normal casi siempre juega de lo mejor, pero no siempre lo mejor', () => {
    const hand = [card('8', 'opponent')];
    const mine = board('opponent', [null, null, null, null]);
    const yours = board('player', ['K', '5', null, null]);
    expect(chooseOpponentMove(hand, mine, yours, 'normal', fixed(0.1))?.slotIndex).toBe(1);
    const picks = new Set([0.6, 0.85, 0.95].map(r => chooseOpponentMove(hand, mine, yours, 'normal', fixed(r))?.slotIndex));
    expect(picks.size).toBeGreaterThan(1);
  });

  it('nunca elige un hueco ocupado, en ninguna dificultad y con ningún azar', () => {
    const own = board('opponent', ['2', null, '3', null]);
    const yours = board('player', ['K', '9', null, '4']);
    (['easy', 'normal', 'hard'] as Difficulty[]).forEach(d => {
      for (let r = 0; r < 1; r += 0.05) {
        const move = chooseOpponentMove([card('7', 'opponent')], own, yours, d, fixed(r));
        expect([1, 3]).toContain(move?.slotIndex);
      }
    });
  });

  it('pone sus sellos donde rinden: el escudo sobre la carta que vas a golpear', () => {
    const mine = boardOf([card('5', 'opponent', 'weak'), card('10', 'opponent', 'safe')]);
    const yours = boardOf([card('9', 'player', 'p9')]);
    const move = chooseOpponentMove([card('SEAL', 'opponent', 'sh', { suit: 'seal', value: 0, seal: 'shield' })], mine, yours, 'hard', fixed(0));
    expect(move).toEqual({ cardId: 'sh', slotIndex: 0 });
  });
});

describe('el As del rival', () => {
  const hand = [card('A', 'opponent', 'ace'), card('4', 'opponent', 'four')];

  it('con una mesa ganadora no se carga la suya: juega otra', () => {
    const mine = boardOf([card('K', 'opponent', 'k', { seal: 'double' }), card('Q', 'opponent', 'q')]);
    const yours = boardOf([card('3', 'player', 'p3')]);
    expect(chooseOpponentMove(hand, mine, yours, 'hard', fixed(0.5))!.cardId).toBe('four');
  });

  it('si solo le queda el As y va ganando, se planta y lo guarda', () => {
    const mine = boardOf([card('K', 'opponent', 'k'), card('Q', 'opponent', 'q')]);
    expect(chooseOpponentMove([card('A', 'opponent', 'ace')], mine, boardOf([]), 'hard', fixed(0.5))).toBeNull();
  });

  it('si tú vas mucho mejor, borra la mesa', () => {
    const yours = boardOf([card('K', 'player', 'pk'), card('Q', 'player', 'pq'), card('J', 'player', 'pj')]);
    expect(chooseOpponentMove(hand, boardOf([]), yours, 'hard', fixed(0.5))!.cardId).toBe('ace');
  });
});
