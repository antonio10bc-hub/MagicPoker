import { create } from 'zustand';
import { Card, BoardSlot, PlayerState, GamePhase } from '@/types';
import { createDeck } from '@/lib/game-utils';

interface GameState {
  phase: GamePhase;
  turn: 'player' | 'opponent'; // Quién tiene la prioridad actual
  
  player: PlayerState;
  opponent: PlayerState;

  // Acciones
  startGame: () => void;
  placeCard: (cardId: string, slotIndex: number) => void;
  opponentTurnAction: () => void;
  passTurn: () => void;
}

// Helper para reiniciar los slots vacíos
const INITIAL_SLOTS: BoardSlot[] = [0, 1, 2, 3].map(i => ({ index: i as 0|1|2|3, card: null }));

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'start',
  turn: 'player',
  
  player: { 
    lives: 4, 
    hand: [], 
    board: JSON.parse(JSON.stringify(INITIAL_SLOTS)), 
    isPassed: false 
  },
  
  opponent: { 
    lives: 4, 
    hand: [], 
    board: JSON.parse(JSON.stringify(INITIAL_SLOTS)), 
    isPassed: false 
  },

  startGame: () => {
    // 1. Crear mazos completos
    const playerDeck = createDeck('player');
    const opponentDeck = createDeck('opponent');

    // 2. Repartir 3 cartas iniciales
    const playerHand = playerDeck.slice(0, 3);
    const opponentHand = opponentDeck.slice(0, 3);

    // 3. Establecer estado inicial
    set({
      phase: 'placement',
      turn: 'player', // Por defecto empieza el jugador, luego ajustaremos con vidas
      player: { 
        lives: 4, 
        hand: playerHand, 
        board: JSON.parse(JSON.stringify(INITIAL_SLOTS)), 
        isPassed: false 
      },
      opponent: { 
        lives: 4, 
        hand: opponentHand, 
        board: JSON.parse(JSON.stringify(INITIAL_SLOTS)), 
        isPassed: false 
      }
    });
  },

  placeCard: (cardId, slotIndex) => {
    const { player, turn, phase, opponent } = get();

    // --- Validaciones ---
    if (phase !== 'placement') return;
    if (turn !== 'player') return; // No es tu turno
    if (player.isPassed) return; // Ya te has plantado
    if (player.board[slotIndex].card !== null) return; // Slot ocupado

    // --- Ejecución ---
    // 1. Encontrar la carta en la mano
    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    
    const cardToPlay = player.hand[cardIndex];

    // 2. Actualizar Mano y Tablero del Jugador
    const newHand = [...player.hand];
    newHand.splice(cardIndex, 1); // Quitar de mano

    const newBoard = [...player.board];
    newBoard[slotIndex] = { ...newBoard[slotIndex], card: cardToPlay }; // Poner en mesa

    // 3. Guardar estado y pasar turno
    set({
      player: { ...player, hand: newHand, board: newBoard },
      turn: 'opponent'
    });

    // 4. Activar la IA del oponente si no se ha plantado
    if (!opponent.isPassed) {
      setTimeout(() => {
        get().opponentTurnAction();
      }, 1000); // 1 segundo de "pensamiento"
    } else {
      // Si el oponente se plantó, el turno vuelve al jugador inmediatamente
      set({ turn: 'player' });
    }
  },

  opponentTurnAction: () => {
    const { opponent, player, phase } = get();
    
    if (phase !== 'placement') return;

    // IA Sencilla: Busca el primer hueco libre
    const emptySlot = opponent.board.find(slot => slot.card === null);
    
    // Si tiene cartas y hueco, juega
    if (opponent.hand.length > 0 && emptySlot) {
      const cardToPlay = opponent.hand[0]; // Juega siempre la primera carta que tiene
      
      const newHand = [...opponent.hand];
      newHand.shift();

      const newBoard = [...opponent.board];
      const slotIndex = emptySlot.index;
      
      // El oponente juega boca abajo (isFaceUp: false por defecto en createDeck)
      newBoard[slotIndex] = { 
        ...newBoard[slotIndex], 
        card: cardToPlay 
      }; 

      set({
        opponent: { ...opponent, hand: newHand, board: newBoard },
        turn: 'player'
      });
    } else {
      // Si no tiene cartas o huecos, se planta
      set({
        opponent: { ...opponent, isPassed: true },
        turn: 'player'
      });
    }
  },

  passTurn: () => {
    const { player, opponent } = get();
    
    // El jugador decide plantarse
    set({
      player: { ...player, isPassed: true },
      turn: 'opponent'
    });

    // Si el oponente aún no se ha plantado, juega su turno
    if (!opponent.isPassed) {
       setTimeout(() => {
        get().opponentTurnAction();
      }, 1000);
    }
    
    // NOTA: Aquí faltaría comprobar si AMBOS se han plantado para pasar a la fase de COMBATE.
    // Lo añadiremos en el siguiente paso.
  }
}));