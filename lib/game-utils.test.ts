import { describe, expect, it } from 'vitest';
import { BoardSlot, Card, Owner, Rank } from '@/types';
import {
  calculateCombat, createDeck, createEmptyBoard, createPlayerState, drawCards, getGameResult,
  getTargetIndices, isIdleDraw, isStalemate, nextIdleTurns, playCardToSlot, RANKS, shuffle,
  nextOpener,
} from '@/lib/game-utils';
import { chooseOpponentMove } from '@/lib/ai';

const card = (rank: Rank, owner: Owner, id = `${owner}-${rank}`): Card => ({
  id, rank, owner, suit: rank === 'JOKER' ? 'joker' : 'standard', value: RANKS[rank].value, isFaceUp: true,
});

const board = (owner: Owner, ranks: (Rank | null)[]): BoardSlot[] =>
  createEmptyBoard().map((slot, i) => ({ ...slot, card: ranks[i] ? card(ranks[i]!, owner, `${owner}-${i}`) : null }));

describe('deck', () => {
  it('has 13 standard cards + 1 joker with unique ids', () => {
    const deck = createDeck('player');
    expect(deck).toHaveLength(14);
    expect(new Set(deck.map(c => c.id)).size).toBe(14);
    expect(deck.filter(c => c.suit === 'joker')).toHaveLength(1);
  });

  it('shuffle keeps every element and does not mutate', () => {
    const items = [1, 2, 3, 4, 5];
    const result = shuffle(items);
    expect(items).toEqual([1, 2, 3, 4, 5]);
    expect([...result].sort()).toEqual(items);
  });
});

describe('player state helpers', () => {
  it('deals the starting hand from the top of the deck', () => {
    const deck = createDeck('player');
    const state = createPlayerState(deck, 3, true);
    expect(state.hand.map(c => c.id)).toEqual(deck.slice(0, 3).map(c => c.id));
    expect(state.hand.every(c => c.isFaceUp)).toBe(true);
    expect(state.deck).toHaveLength(11);
  });

  it('draws only what is left in the deck', () => {
    const state = createPlayerState(createDeck('player').slice(0, 1));
    const next = drawCards(state, 2, true);
    expect(next.hand).toHaveLength(1);
    expect(next.deck).toHaveLength(0);
  });

  it('cannot play onto an occupied slot', () => {
    const state = { ...createPlayerState(createDeck('player'), 2, true) };
    const [a, b] = state.hand;
    const afterFirst = playCardToSlot(state, a.id, 0, true)!;
    expect(afterFirst.board[0].card?.id).toBe(a.id);
    expect(playCardToSlot(afterFirst, b.id, 0, true)).toBeNull();
  });
});

describe('targets', () => {
  it('follows each rank attack pattern and stays on the board', () => {
    expect(getTargetIndices(0, '7')).toEqual([0]);
    expect(getTargetIndices(0, 'Q')).toEqual([1]);
    expect(getTargetIndices(2, 'Q')).toEqual([1, 3]);
    expect(getTargetIndices(3, 'K')).toEqual([2, 3]);
    expect(getTargetIndices(1, 'JOKER')).toEqual([]);
    expect(getTargetIndices(1, 'A')).toEqual([]);
  });
});

describe('calculateCombat', () => {
  it('higher card destroys lower card in front', () => {
    const r = calculateCombat(board('player', ['9']), board('opponent', ['5']));
    expect(r.deadCardIds).toEqual(['opponent-0']);
    expect(r.playerDamageTaken + r.opponentDamageTaken).toBe(0);
  });

  it('equal cards destroy each other', () => {
    const r = calculateCombat(board('player', ['7']), board('opponent', ['7']));
    expect(r.deadCardIds.sort()).toEqual(['opponent-0', 'player-0']);
  });

  it('hitting an empty slot deals 1 direct damage', () => {
    const r = calculateCombat(board('player', [null, '3']), board('opponent', []));
    expect(r.opponentDamageTaken).toBe(1);
    expect(r.opponentEmptySlotsHit).toEqual({ 1: 1 });
  });

  it('king hits three slots and marks its victims', () => {
    const r = calculateCombat(board('player', [null, 'K']), board('opponent', ['5', null, '9']));
    expect(r.opponentDamageTaken).toBe(1);
    expect(r.deadCardIds.sort()).toEqual(['opponent-0', 'opponent-2']);
    expect(r.damageSources['opponent-0']).toEqual({ rank: 'K', owner: 'player' });
  });

  it('jack hits exactly one random target', () => {
    const r = calculateCombat(board('player', [null, 'J']), board('opponent', []), () => 0.99);
    expect(r.opponentEmptySlotsHit).toEqual({ 2: 1 });
  });

  it('ace voids every card and deals no damage', () => {
    const r = calculateCombat(board('player', ['A', '5']), board('opponent', ['J', 'Q', 'K']));
    expect(r.voidedCardIds).toHaveLength(5);
    expect(r.deadCardIds).toHaveLength(0);
    expect(r.playerDamageTaken + r.opponentDamageTaken).toBe(0);
    expect(r.isRepublicanaTriggered).toBe(true);
  });

  it('joker does not attack but can be destroyed', () => {
    const r = calculateCombat(board('player', ['JOKER']), board('opponent', ['2']));
    expect(r.deadCardIds).toEqual(['player-0']);
    expect(r.opponentDamageTaken).toBe(0);
  });
});

describe('getGameResult', () => {
  const base = createPlayerState(createDeck('player'), 3);
  it('is null while both players can continue', () => {
    expect(getGameResult(base, base)).toBeNull();
  });
  it('detects win, loss and draw by lives', () => {
    expect(getGameResult(base, { ...base, lives: 0 })).toBe('win');
    expect(getGameResult({ ...base, lives: 0 }, base)).toBe('loss');
    expect(getGameResult({ ...base, lives: 0 }, { ...base, lives: 0 })).toBe('draw');
  });
  it('loses when out of cards while the rival still has cards on board', () => {
    const empty = createPlayerState();
    const rival = { ...empty, board: board('opponent', ['5']) };
    expect(getGameResult(empty, rival)).toBe('loss');
    expect(getGameResult(empty, empty)).toBe('draw');
  });
});

describe('opponent AI', () => {
  const hand = [card('9', 'opponent')];

  it('passes when there is no card or no free slot', () => {
    expect(chooseOpponentMove([], createEmptyBoard(), createEmptyBoard(), 'easy')).toBeNull();
    expect(chooseOpponentMove(hand, board('opponent', ['2', '2', '2', '2']), createEmptyBoard(), 'easy')).toBeNull();
  });

  it('hard plays where it beats a player card', () => {
    const move = chooseOpponentMove(hand, createEmptyBoard(), board('player', ['K', null, '5']), 'hard', () => 0);
    expect(move).toEqual({ cardId: hand[0].id, slotIndex: 2 });
  });

  it('only chooses free slots', () => {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const move = chooseOpponentMove(hand, board('opponent', ['2', '2', null, '2']), board('player', ['K']), difficulty);
      expect(move?.slotIndex).toBe(2);
    }
  });
});

describe('mano inicial y bloqueos', () => {
  const c = (rank: Rank, id: string): Card => ({ id, rank, owner: 'player', suit: rank === 'SEAL' ? 'seal' : 'standard', value: RANKS[rank].value, isFaceUp: false, ...(rank === 'SEAL' ? { seal: 'shield' as const } : {}) });

  it('la mano inicial trae como mucho un sello', () => {
    const deck = [c('SEAL', 's1'), c('SEAL', 's2'), c('SEAL', 's3'), c('SEAL', 's4'), c('5', 'n1'), c('7', 'n2')];
    const state = createPlayerState(deck, 3, true);
    expect(state.hand.filter(x => x.rank === 'SEAL')).toHaveLength(1);
    expect(state.hand.map(x => x.id)).toEqual(['s1', 'n1', 'n2']);
    // No se pierde ninguna carta
    expect([...state.hand, ...state.deck].map(x => x.id).sort()).toEqual(deck.map(x => x.id).sort());
  });

  it('sin cartas normales de sobra, se queda como está', () => {
    const deck = [c('SEAL', 's1'), c('SEAL', 's2'), c('SEAL', 's3')];
    expect(createPlayerState(deck, 3, true).hand).toHaveLength(3);
  });

  it('bloqueo: sin cartas en mano ni mazo y una pelea en la que no pasa nada → empate', () => {
    const tower = (owner: Owner, id: string): Card => ({ id, rank: 'TOWER', owner, suit: 'standard', value: 15, isFaceUp: true });
    const board = (owner: Owner) => createEmptyBoard().map((s, i) => ({ ...s, card: tower(owner, `${owner}-${i}`) }));
    const p = { ...createPlayerState(), board: board('player') };
    const o = { ...createPlayerState(), board: board('opponent') };
    const r = calculateCombat(p.board, o.board);
    expect(isStalemate(p, o, r)).toBe(true);
    // Si a alguien le queda una carta en la mano, no
    expect(isStalemate({ ...p, hand: [c('5', 'x')] }, o, r)).toBe(false);
  });

  it('inactividad: con solo sellos en la mano y la mesa vacía nadie puede jugar; tras 4 turnos sin jugar → empate', () => {
    const seal: Card = { id: 's', rank: 'SEAL', owner: 'player', suit: 'seal', value: 0, isFaceUp: true, seal: 'shield' };
    const p = { ...createPlayerState(), hand: [seal], deck: [seal] };
    const o = { ...createPlayerState(), hand: [{ ...seal, owner: 'opponent' as Owner }] };
    // El sello no se puede poner sin una carta tuya en la mesa
    expect(playCardToSlot(p, 's', 0, true)).toBeNull();
    const quiet = calculateCombat(p.board, o.board);
    // Dos rondas en las que los dos se plantan: 4 turnos sin jugar
    let idle = 0;
    for (let i = 0; i < 2; i++) idle = nextIdleTurns(nextIdleTurns(idle, 'pass'), 'pass');
    expect(idle).toBe(4);
    expect(isIdleDraw(3, p, o, quiet)).toBe(false);
    expect(isIdleDraw(idle, p, o, quiet)).toBe(true);
    // Jugar una carta reinicia la cuenta
    expect(nextIdleTurns(3, 'play')).toBe(0);
  });

  it('inactividad: si la pelea cambia algo (daño), la partida sigue aunque nadie juegue', () => {
    const p = { ...createPlayerState(), board: createEmptyBoard().map((s, i) => (i === 0 ? { ...s, card: card('9', 'player') } : s)) };
    const o = createPlayerState();
    const r = calculateCombat(p.board, o.board);
    expect(r.opponentDamageTaken).toBeGreaterThan(0);
    expect(isIdleDraw(6, p, o, r)).toBe(false);
  });
});

describe('quién abre la ronda (tras el cara o cruz)', () => {
  const side = (lives: number, maxLives: number) => ({ ...createPlayerState([], 0, true, lives), maxLives });
  it('abre quien va ganando, por la parte de sus vidas que le queda', () => {
    // 3/4 tuyas contra 4/6 del jefe: vas ganando aunque él tenga más vidas sueltas
    expect(nextOpener(side(3, 4), side(4, 6), 'opponent')).toBe('player');
    expect(nextOpener(side(2, 4), side(4, 6), 'player')).toBe('opponent');
  });
  it('si van igual, repite quien abrió la anterior', () => {
    expect(nextOpener(side(2, 4), side(3, 6), 'opponent')).toBe('opponent');
    expect(nextOpener(side(4, 4), side(5, 5), 'player')).toBe('player');
  });
});
