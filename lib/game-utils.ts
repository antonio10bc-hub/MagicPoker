import { Card, BoardSlot, Rank, CombatResult } from "@/types";

const RANK_VALUES: Record<Rank, number> = {
  'JOKER': 0,
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

// NUEVO: Exportar para que la IA pueda usarlo
export const getCardValue = (rank: Rank): number => RANK_VALUES[rank];

export const createDeck = (owner: 'player' | 'opponent'): Card[] => {
  const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  let deck: Card[] = [];

  ranks.forEach(rank => {
    deck.push({
      id: Math.random().toString(36).substr(2, 9),
      rank,
      suit: 'standard',
      value: RANK_VALUES[rank],
      isFaceUp: false,
      owner
    });
  });

  deck.push({
    id: Math.random().toString(36).substr(2, 9),
    rank: 'JOKER',
    suit: 'joker',
    value: RANK_VALUES['JOKER'],
    isFaceUp: false,
    owner
  });

  return deck.sort(() => Math.random() - 0.5);
};

export const calculateCombat = (playerBoard: BoardSlot[], opponentBoard: BoardSlot[]): CombatResult => {
  let playerDamage = 0;
  let opponentDamage = 0;
  const deadIds = new Set<string>();
  const voidedIds = new Set<string>();
  
  const playerEmptyHits: Record<number, number> = {};
  const opponentEmptyHits: Record<number, number> = {};
  const damageSources: Record<string, { rank: Rank, owner: 'player' | 'opponent' }> = {};

  // 1. REGLA DEL AS (Board Wipe)
  const aceCard = [...playerBoard, ...opponentBoard].find(s => s.card?.rank === 'A')?.card;
  if (aceCard) {
    const allCards = [...playerBoard, ...opponentBoard]
      .map(s => s.card)
      .filter((c): c is Card => !!c);
    
    allCards.forEach(c => {
        voidedIds.add(c.id);
        damageSources[c.id] = { rank: 'A', owner: aceCard.owner };
    });
    
    return {
      playerDamageTaken: 0, opponentDamageTaken: 0,
      deadCardIds: [], voidedCardIds: Array.from(voidedIds),
      playerEmptySlotsHit: {}, opponentEmptySlotsHit: {}, damageSources
    };
  }

  // Helper para resolver choques
  const resolveInteraction = (attacker: Card, defenderSlot: BoardSlot, isPlayerAttacking: boolean) => {
    const defender = defenderSlot.card;

    if (!defender) {
      if (isPlayerAttacking) {
        opponentDamage++;
        opponentEmptyHits[defenderSlot.index] = (opponentEmptyHits[defenderSlot.index] || 0) + 1;
      } else {
        playerDamage++;
        playerEmptyHits[defenderSlot.index] = (playerEmptyHits[defenderSlot.index] || 0) + 1;
      }
    } else {
      if (attacker.value > defender.value) {
        deadIds.add(defender.id);
        if (['K', 'Q', 'J'].includes(attacker.rank)) {
            damageSources[defender.id] = { rank: attacker.rank, owner: attacker.owner };
        }
      } else if (attacker.value < defender.value) {
        deadIds.add(attacker.id);
      } else {
        deadIds.add(attacker.id);
        deadIds.add(defender.id);
      }
    }
  };

  const processAttackTurn = (attackBoard: BoardSlot[], defenseBoard: BoardSlot[], isPlayerAttacking: boolean) => {
    attackBoard.forEach(slot => {
      if (!slot.card) return;
      const rank = slot.card.rank;

      if (rank === 'JOKER') return;

      const targetIndices = getTargetIndices(slot.index, rank);
      if (targetIndices.length === 0) return;

      if (rank === 'J') {
        const randomIndex = targetIndices[Math.floor(Math.random() * targetIndices.length)];
        const targetSlot = defenseBoard.find(s => s.index === randomIndex);
        
        if (targetSlot) {
            resolveInteraction(slot.card, targetSlot, isPlayerAttacking);
        }

      } else {
        targetIndices.forEach(idx => {
          const targetSlot = defenseBoard.find(s => s.index === idx);
          if (targetSlot) {
            resolveInteraction(slot.card!, targetSlot, isPlayerAttacking);
          }
        });
      }
    });
  };

  processAttackTurn(playerBoard, opponentBoard, true);  
  processAttackTurn(opponentBoard, playerBoard, false); 

  return {
    playerDamageTaken: playerDamage,
    opponentDamageTaken: opponentDamage,
    deadCardIds: Array.from(deadIds),
    voidedCardIds: [],
    playerEmptySlotsHit: playerEmptyHits,
    opponentEmptySlotsHit: opponentEmptyHits,
    damageSources
  };
};

const getTargetIndices = (index: number, rank: Rank): number[] => {
  const targets: number[] = [];
  const add = (i: number) => { if (i >= 0 && i <= 3) targets.push(i); };

  if (rank === 'Q') {
    add(index - 1);
    add(index + 1);
  } else if (rank === 'K' || rank === 'J') {
    add(index - 1);
    add(index);
    add(index + 1);
  } else {
    add(index);
  }
  return targets;
};