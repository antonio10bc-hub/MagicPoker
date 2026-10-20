import { describe, expect, it } from 'vitest';
import { BoardSlot, Card, Owner, Rank, SealId } from '@/types';
import {
  applyPreCombatSeals, calculateCombat, clearDefeatedCards, createEmptyBoard, createPlayerState, createSealCard,
  lifeGains, markCombatResult, playCardToSlot, RANKS,
} from '@/lib/game-utils';
import { chooseOpponentMove } from '@/lib/ai';

const card = (rank: Rank, owner: Owner, id: string, seal?: SealId): Card => ({
  id, rank, owner, suit: 'standard', value: RANKS[rank].value, isFaceUp: true, seal,
});
type Spec = [Rank, SealId?] | null;
const board = (owner: Owner, specs: Spec[]): BoardSlot[] =>
  createEmptyBoard().map((slot, i) => {
    const sp = specs[i];
    return { ...slot, card: sp ? card(sp[0], owner, `${owner}-${i}`, sp[1]) : null };
  });

describe('aplicar un sello', () => {
  it('va sobre una carta propia sin sello y gasta la carta de sello', () => {
    const seal = createSealCard('player', 'shield');
    const state = { ...createPlayerState(), hand: [seal], board: board('player', [['5'], null, ['7', 'life'], null]) };
    const next = playCardToSlot(state, seal.id, 0, true)!;
    expect(next.board[0].card?.seal).toBe('shield');
    expect(next.hand).toHaveLength(0);
    // No sobre un hueco vacío ni sobre una carta que ya tiene sello
    expect(playCardToSlot(state, seal.id, 1, true)).toBeNull();
    expect(playCardToSlot(state, seal.id, 2, true)).toBeNull();
  });
});

describe('defensa', () => {
  it('aguanta todos los golpes de la pelea y el sello se rompe', () => {
    const me = board('player', [null, ['3', 'shield'], null, null]);
    const rival = board('opponent', [['K'], ['9'], ['Q'], null]); // Rey, 9 y Reina golpean al hueco 1
    const r = calculateCombat(me, rival);
    expect(r.deadCardIds).not.toContain('player-1');
    expect(r.shieldedIds).toEqual(['player-1']);
    const after = clearDefeatedCards(markCombatResult(me, r));
    expect(after[1].card?.seal).toBeUndefined();
    expect(after[1].card?.rank).toBe('3');
  });

  it('no salva del As', () => {
    const r = calculateCombat(board('player', [['3', 'shield'], null, null, null]), board('opponent', [['A'], null, null, null]));
    expect(r.voidedCardIds).toContain('player-0');
  });
});

describe('ataque doble', () => {
  it('contra un hueco vacío hace 2 de daño', () => {
    const r = calculateCombat(board('player', [['5', 'double'], null, null, null]), board('opponent', [null, null, null, null]));
    expect(r.opponentDamageTaken).toBe(2);
  });

  it('el Rey golpea dos veces cada uno de sus 3 huecos', () => {
    const r = calculateCombat(board('player', [null, ['K', 'double'], null, null]), board('opponent', [null, null, null, null]));
    expect(r.opponentDamageTaken).toBe(6);
  });
});

describe('cambio', () => {
  it('se cambia con el hueco de su derecha, y del último salta al primero', () => {
    const r1 = applyPreCombatSeals(board('player', [['5', 'shift'], ['9'], null, null]), board('opponent', [null, null, null, null]));
    expect(r1.player.map(s => s.card?.rank ?? null)).toEqual(['9', '5', null, null]);
    const r2 = applyPreCombatSeals(board('player', [['2'], null, null, ['5', 'shift']]), board('opponent', [null, null, null, null]));
    expect(r2.player.map(s => s.card?.rank ?? null)).toEqual(['5', null, null, '2']);
    expect(r2.player[0].card?.seal).toBe('shift'); // el sello no se rompe: cambia cada turno
  });

  it('se mueve aunque el hueco de la derecha esté vacío', () => {
    const r = applyPreCombatSeals(board('player', [['5', 'shift'], null, null, null]), board('opponent', [null, null, null, null]));
    expect(r.player.map(s => s.card?.rank ?? null)).toEqual([null, '5', null, null]);
  });
});

describe('cambio con enemigo', () => {
  it('su carta pasa a ser tuya y la tuya suya; el sello se rompe', () => {
    const r = applyPreCombatSeals(board('player', [['3', 'swap'], null, null, null]), board('opponent', [['K'], null, null, null]));
    expect(r.player[0].card).toMatchObject({ rank: 'K', owner: 'player' });
    expect(r.opponent[0].card).toMatchObject({ rank: '3', owner: 'opponent' });
    expect(r.opponent[0].card?.seal).toBeUndefined();
  });

  it('sin carta enfrente el sello espera', () => {
    const r = applyPreCombatSeals(board('player', [['3', 'swap'], null, null, null]), board('opponent', [null, null, null, null]));
    expect(r.player[0].card?.seal).toBe('swap');
    expect(r.events).toHaveLength(0);
  });
});

describe('vida', () => {
  it('al morir la carta su dueño recupera una vida', () => {
    const me = board('player', [['3', 'life'], null, null, null]);
    const r = calculateCombat(me, board('opponent', [['9'], null, null, null]));
    expect(lifeGains(me, r)).toBe(1);
  });
});

describe('IA con sellos', () => {
  it('el boss usa su sello en cuanto tiene dónde y elige bien el objetivo', () => {
    const seal = createSealCard('opponent', 'swap');
    const own = board('opponent', [['2'], ['3'], null, null]);
    const yours = board('player', [['5'], ['K'], null, null]);
    expect(chooseOpponentMove([card('7', 'opponent', 'c'), seal], own, yours, 'hard')).toEqual({ cardId: seal.id, slotIndex: 1 });
  });

  it('sin carta propia donde ponerlo, juega una carta normal', () => {
    const seal = createSealCard('opponent', 'shield');
    const move = chooseOpponentMove([seal, card('7', 'opponent', 'c')], board('opponent', [null, null, null, null]), board('player', [null, null, null, null]), 'hard', () => 0);
    expect(move?.cardId).toBe('c');
  });
});
