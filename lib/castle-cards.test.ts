import { describe, expect, it } from 'vitest';
import { BoardSlot, Card, Owner, Rank, SealId } from '@/types';
import {
  calculateCombat, createEmptyBoard, createPlayerState, createWildSealCard, DECK_RANKS, lifeGains, playCardToSlot, RANKS,
} from '@/lib/game-utils';

const card = (rank: Rank, owner: Owner, id: string, seal?: SealId): Card => ({
  id, rank, owner, suit: 'standard', value: RANKS[rank].value, isFaceUp: true, seal,
});
const board = (owner: Owner, specs: ([Rank, SealId?] | null)[]): BoardSlot[] =>
  createEmptyBoard().map((slot, i) => ({ ...slot, card: specs[i] ? card(specs[i]![0], owner, `${owner}-${i}`, specs[i]![1]) : null }));

describe('cartas del Castillo', () => {
  it('no están en el mazo estándar', () => {
    expect(DECK_RANKS).not.toContain('TOWER');
    expect(DECK_RANKS).toHaveLength(14);
  });

  it('Bufón: copia el ataque de la carta de enfrente (un Rey: sus 3 huecos)', () => {
    const r = calculateCombat(board('player', [null, ['JESTER'], null, null]), board('opponent', [null, ['K'], null, null]));
    // Copia al Rey: golpea los huecos 0 y 2 (vacíos) y choca con el Rey (y pierde)
    expect(r.opponentDamageTaken).toBe(2);
    expect(r.deadCardIds).toContain('player-1');
  });

  it('Torre: no ataca y vale 15, así que quien la golpea cae', () => {
    const r = calculateCombat(board('player', [['TOWER']]), board('opponent', [['K']]));
    expect(r.deadCardIds).toEqual(['opponent-0']);
    expect(r.opponentDamageTaken).toBe(0);
  });

  it('Bomba: al caer golpea los huecos rivales de al lado', () => {
    const r = calculateCombat(board('player', [null, ['BOMB'], null, null]), board('opponent', [['5'], ['9'], null, null]));
    expect(r.deadCardIds.sort()).toEqual(['opponent-0', 'player-1']);
    expect(r.bombVictimIds).toEqual(['opponent-0']);
    // El hueco 2 rival estaba vacío: una vida
    expect(r.opponentDamageTaken).toBe(1);
  });

  it('Caballero: salta y golpea a dos huecos de distancia', () => {
    const r = calculateCombat(board('player', [null, null, ['KNIGHT'], null]), board('opponent', [['7'], null, ['2'], null]));
    expect(r.deadCardIds).toContain('opponent-0');
    // No golpea el de enfrente (el 2 le golpea a él y pierde)
    expect(r.deadCardIds).toContain('opponent-2');
  });

  it('Sacerdotisa: si sobrevive, una vida', () => {
    const me = board('player', [['PRIESTESS'], null, null, null]);
    const r = calculateCombat(me, board('opponent', [['3'], null, null, null]));
    expect(r.blessedIds).toEqual(['player-0']);
    expect(lifeGains(me, r)).toBe(1);
  });

  it('Comodín de sello: se juega diciendo qué sello es', () => {
    const wild = createWildSealCard('player');
    const state = { ...createPlayerState(), hand: [wild], board: board('player', [['5'], null, null, null]) };
    expect(playCardToSlot(state, wild.id, 0, true)).toBeNull();
    expect(playCardToSlot(state, wild.id, 0, true, 'mirror')!.board[0].card?.seal).toBe('mirror');
  });
});
