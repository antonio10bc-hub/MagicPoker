import { Card, BoardSlot, Rank } from "@/types";

const RANK_VALUES: Record<Rank, number> = {
  'JOKER': 0,
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

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

interface CombatResult {
  playerDamageTaken: number;
  opponentDamageTaken: number;
  deadCardIds: string[];
  playerEmptySlotsHit: number[];   // <--- NUEVO: Qué huecos vacíos del jugador recibieron daño
  opponentEmptySlotsHit: number[]; // <--- NUEVO: Qué huecos vacíos del rival recibieron daño
}

export const calculateCombat = (playerBoard: BoardSlot[], opponentBoard: BoardSlot[]): CombatResult => {
  let playerDamage = 0;
  let opponentDamage = 0;
  const deadIds = new Set<string>();
  
  // Sets para guardar índices únicos de huecos golpeados
  const playerEmptyHits = new Set<number>();
  const opponentEmptyHits = new Set<number>();

  // 1. Verificar AS (Board Wipe)
  const hasAce = [...playerBoard, ...opponentBoard].some(s => s.card?.rank === 'A');
  if (hasAce) {
    const allCards = [...playerBoard, ...opponentBoard]
      .map(s => s.card?.id)
      .filter((id): id is string => !!id);
    
    return {
      playerDamageTaken: 0,
      opponentDamageTaken: 0,
      deadCardIds: allCards,
      playerEmptySlotsHit: [],
      opponentEmptySlotsHit: []
    };
  }

  // Helper para resolver un choque individual
  const resolveInteraction = (attacker: Card, defenderSlot: BoardSlot, isPlayerAttacking: boolean) => {
    const defender = defenderSlot.card;

    if (!defender) {
      // Golpe directo a hueco vacío
      if (isPlayerAttacking) {
        opponentDamage++;
        opponentEmptyHits.add(defenderSlot.index); // Registramos el hueco vacío golpeado
      } else {
        playerDamage++;
        playerEmptyHits.add(defenderSlot.index);   // Registramos el hueco vacío golpeado
      }
    } else {
      // Choque de cartas
      if (attacker.value > defender.value) {
        deadIds.add(defender.id);
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
      const possibleTargets = getTargets(slot.index, rank);

      if (rank === 'J') {
        // Jota: Elige uno de los posibles
        const targetSlots = possibleTargets.map(idx => defenseBoard.find(s => s.index === idx)!);
        const emptySlots = targetSlots.filter(s => s.card === null);
        const occupiedSlots = targetSlots.filter(s => s.card !== null);

        let finalTarget: BoardSlot;
        if (emptySlots.length > 0) {
          finalTarget = emptySlots[Math.floor(Math.random() * emptySlots.length)];
        } else {
          finalTarget = occupiedSlots[Math.floor(Math.random() * occupiedSlots.length)];
        }
        resolveInteraction(slot.card, finalTarget, isPlayerAttacking);

      } else {
        // K, Q, Normales: Atacan a TODOS
        possibleTargets.forEach(targetIndex => {
          const targetSlot = defenseBoard.find(s => s.index === targetIndex);
          if (targetSlot) {
            resolveInteraction(slot.card!, targetSlot, isPlayerAttacking);
          }
        });
      }
    });
  };

  // 2. Ejecutar ataques
  processAttackTurn(playerBoard, opponentBoard, true);  
  processAttackTurn(opponentBoard, playerBoard, false); 

  return {
    playerDamageTaken: playerDamage,
    opponentDamageTaken: opponentDamage,
    deadCardIds: Array.from(deadIds),
    playerEmptySlotsHit: Array.from(playerEmptyHits),
    opponentEmptySlotsHit: Array.from(opponentEmptyHits)
  };
};

const getTargets = (index: number, rank: Rank): number[] => {
  const targets: number[] = [];
  
  const addIfValid = (i: number) => {
    if (i >= 0 && i <= 3) targets.push(i);
  };

  // REINA (Q): SOLO Diagonales (index -1, index + 1). NO FRONTAL.
  if (rank === 'Q') {
    addIfValid(index - 1);
    addIfValid(index + 1);
  } 
  // REY (K) y JOTA (J): Tridente (index -1, 0, +1)
  else if (rank === 'K' || rank === 'J') {
    addIfValid(index - 1);
    addIfValid(index);
    addIfValid(index + 1);
  } 
  // RESTO: Solo frontal
  else {
    addIfValid(index);
  }

  return targets;
};