import { create } from 'zustand';
import { BoardSlot, PlayerState, GamePhase, DamageEvent } from '@/types';
import { createDeck, calculateCombat } from '@/lib/game-utils';

interface GameState {
  phase: GamePhase;
  turn: 'player' | 'opponent';
  player: PlayerState;
  opponent: PlayerState;
  roundNumber: number;
  recentDamage: DamageEvent | null;

  startGame: () => void;
  resetGame: () => void;
  placeCard: (cardId: string, slotIndex: number) => void;
  passTurn: () => void;
  opponentTurnAction: () => void;
  resolveCombatPhase: () => void;
  drawCard: (target: 'player' | 'opponent', amount?: number) => void;
}

const INITIAL_SLOTS: BoardSlot[] = [0, 1, 2, 3].map(i => ({ index: i as 0|1|2|3, card: null }));

const getInitialPlayerState = (): PlayerState => ({
    lives: 4, hand: [], board: JSON.parse(JSON.stringify(INITIAL_SLOTS)), deck: [], isPassed: false 
});

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'start',
  turn: 'player',
  roundNumber: 1,
  recentDamage: null,
  
  player: getInitialPlayerState(),
  opponent: getInitialPlayerState(),

  startGame: () => {
    const playerDeckFull = createDeck('player');
    const opponentDeckFull = createDeck('opponent');

    const playerHand = playerDeckFull.slice(0, 3).map(c => ({ ...c, isFaceUp: true }));
    const playerDeck = playerDeckFull.slice(3);
    
    const opponentHand = opponentDeckFull.slice(0, 3);
    const opponentDeck = opponentDeckFull.slice(3);

    set({
      phase: 'placement',
      turn: 'player',
      roundNumber: 1,
      recentDamage: null,
      player: { ...getInitialPlayerState(), hand: playerHand, deck: playerDeck },
      opponent: { ...getInitialPlayerState(), hand: opponentHand, deck: opponentDeck }
    });
  },

  resetGame: () => {
    set({
        phase: 'start',
        turn: 'player',
        roundNumber: 1,
        recentDamage: null,
        player: getInitialPlayerState(),
        opponent: getInitialPlayerState(),
    });
    get().startGame();
  },

  drawCard: (target, amount = 1) => {
    const state = get();
    const playerState = state[target];
    if (playerState.deck.length === 0) return;

    const drawnCards = playerState.deck.slice(0, amount);
    const processedCards = drawnCards.map(c => ({ ...c, isFaceUp: target === 'player' }));
    const remainingDeck = playerState.deck.slice(amount);
    
    set({
      [target]: { ...playerState, hand: [...playerState.hand, ...processedCards], deck: remainingDeck }
    });
  },

  placeCard: (cardId, slotIndex) => {
    const { player, turn, phase, opponent } = get();
    if (phase !== 'placement' || turn !== 'player' || player.isPassed || player.board[slotIndex].card) return;

    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    
    const cardToPlay = { ...player.hand[cardIndex], isFaceUp: true }; 
    if (cardToPlay.rank === 'JOKER') get().drawCard('player', 2);

    const currentPlayerState = get().player; 
    const updatedHand = currentPlayerState.hand.filter(c => c.id !== cardId);
    const newBoard = [...currentPlayerState.board];
    newBoard[slotIndex] = { ...newBoard[slotIndex], card: cardToPlay };

    set({
      player: { ...currentPlayerState, hand: updatedHand, board: newBoard },
      turn: 'opponent'
    });

    if (!opponent.isPassed) {
      setTimeout(() => get().opponentTurnAction(), 400);
    } else {
      set({ turn: 'player' });
    }
  },

  passTurn: () => {
    const { opponent } = get();
    set(state => ({ player: { ...state.player, isPassed: true }, turn: 'opponent' }));

    if (!opponent.isPassed) {
      setTimeout(() => get().opponentTurnAction(), 400);
    } else {
      get().resolveCombatPhase();
    }
  },

  opponentTurnAction: () => {
    const { opponent, player } = get();
    
    const availableSlots = opponent.board.filter(slot => slot.card === null);

    if (opponent.hand.length > 0 && availableSlots.length > 0) {
      const cardToPlay = { ...opponent.hand[0], isFaceUp: false };
      if (cardToPlay.rank === 'JOKER') get().drawCard('opponent', 2);

      let chosenSlotIndex = availableSlots[0].index;
      const defensiveSlots = availableSlots.filter(s => player.board[s.index].card !== null);
      
      if (defensiveSlots.length > 0 && Math.random() > 0.3) {
         chosenSlotIndex = defensiveSlots[Math.floor(Math.random() * defensiveSlots.length)].index;
      } else {
         chosenSlotIndex = availableSlots[Math.floor(Math.random() * availableSlots.length)].index;
      }

      const currentOpponentState = get().opponent;
      const newHand = currentOpponentState.hand.filter(c => c.id !== cardToPlay.id);
      const newBoard = [...currentOpponentState.board];
      newBoard[chosenSlotIndex] = { ...newBoard[chosenSlotIndex], card: cardToPlay };

      set({
        opponent: { ...currentOpponentState, hand: newHand, board: newBoard },
        turn: player.isPassed ? 'opponent' : 'player'
      });
      
      if (player.isPassed) {
          setTimeout(() => get().opponentTurnAction(), 400);
      }
    } else {
      set(state => ({ opponent: { ...state.opponent, isPassed: true } }));
      if (player.isPassed) {
        get().resolveCombatPhase();
      } else {
        set({ turn: 'player' });
      }
    }
  },

  resolveCombatPhase: () => {
    set({ phase: 'combat' });

    // PASO 1: REVELAR
    setTimeout(() => {
      set(state => ({
        opponent: {
          ...state.opponent,
          board: state.opponent.board.map(slot => slot.card ? { ...slot, card: { ...slot.card, isFaceUp: true } } : slot)
        }
      }));

      // PASO 2: CALCULAR DAÑO
      setTimeout(() => {
        const { player, opponent } = get();
        const result = calculateCombat(player.board, opponent.board);

        // AHORA USAMOS LOS HITS REALES DE LA LÓGICA DE COMBATE
        set({ recentDamage: { 
            playerSlots: result.playerEmptySlotsHit, 
            opponentSlots: result.opponentEmptySlotsHit 
        }});

        const markDamage = (board: BoardSlot[]) => board.map(slot => 
            slot.card && result.deadCardIds.includes(slot.card.id) 
                ? { ...slot, card: { ...slot.card, isTakingDamage: true } } 
                : slot
        );

        set(s => ({
            player: { ...s.player, board: markDamage(s.player.board) },
            opponent: { ...s.opponent, board: markDamage(s.opponent.board) }
        }));

        // PASO 3: APLICAR Y LIMPIAR
        setTimeout(() => {
            const currentState = get();
            
            const clearDead = (board: BoardSlot[]) => board.map(slot => 
                slot.card?.isTakingDamage ? { ...slot, card: null } : slot
            );

            const newPlayerLives = Math.max(0, currentState.player.lives - result.playerDamageTaken);
            const newOpponentLives = Math.max(0, currentState.opponent.lives - result.opponentDamageTaken);

            set({
                recentDamage: null,
                player: { ...currentState.player, lives: newPlayerLives, board: clearDead(currentState.player.board), isPassed: false },
                opponent: { ...currentState.opponent, lives: newOpponentLives, board: clearDead(currentState.opponent.board), isPassed: false },
            });

            if (newPlayerLives === 0 || newOpponentLives === 0) {
                set({ phase: 'end' });
                return;
            }

            // ROBAR 2 CARTAS
            get().drawCard('player', 2);
            get().drawCard('opponent', 2);
            set({ phase: 'placement', turn: 'player', roundNumber: currentState.roundNumber + 1 });

        }, 800); 

      }, 500);

    }, 300);
  }
}));