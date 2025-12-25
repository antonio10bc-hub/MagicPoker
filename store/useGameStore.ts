import { create } from 'zustand';
import { BoardSlot, PlayerState, GamePhase, DamageEvent, CombatResult } from '@/types';
import { createDeck, calculateCombat } from '@/lib/game-utils';

interface GameState {
  phase: GamePhase;
  turn: 'player' | 'opponent';
  player: PlayerState;
  opponent: PlayerState;
  roundNumber: number;
  recentDamage: DamageEvent | null;
  pendingCombatResult: CombatResult | null;

  startGame: () => void;
  resetGame: () => void;
  placeCard: (cardId: string, slotIndex: number) => void;
  passTurn: () => Promise<void>; // <--- Promesa para el timing
  opponentTurnAction: () => Promise<void>; // <--- Promesa para el timing
  resolveCombatPhase: () => void;
  finishCombatPhase: () => void;
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
  pendingCombatResult: null,
  
  player: getInitialPlayerState(),
  opponent: getInitialPlayerState(),

  startGame: () => {
    // CORREGIDO: Usamos argumentos 'player' y 'opponent' como en tu código original
    const playerDeckFull = createDeck('player');
    const opponentDeckFull = createDeck('opponent');

    // CORREGIDO: Manual slice (sin usar drawCards que no existe)
    const playerHand = playerDeckFull.slice(0, 3).map(c => ({ ...c, isFaceUp: true }));
    const playerDeck = playerDeckFull.slice(3);
    
    const opponentHand = opponentDeckFull.slice(0, 3);
    const opponentDeck = opponentDeckFull.slice(3);

    set({
      phase: 'placement',
      turn: 'player',
      roundNumber: 1,
      recentDamage: null,
      pendingCombatResult: null,
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
        pendingCombatResult: null,
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
    const currentPlayerState = get().player; 
    const updatedHand = currentPlayerState.hand.filter(c => c.id !== cardId);
    const newBoard = [...currentPlayerState.board];
    newBoard[slotIndex] = { ...newBoard[slotIndex], card: cardToPlay };

    set({
      player: { ...currentPlayerState, hand: updatedHand, board: newBoard },
      turn: 'opponent'
    });

    if (!opponent.isPassed) {
      // TIMING: Espera 1s antes de que la máquina responda
      setTimeout(() => get().opponentTurnAction(), 1000);
    } else {
      set({ turn: 'player' });
    }
  },

  passTurn: async () => {
    const { opponent } = get();
    set(state => ({ player: { ...state.player, isPassed: true }, turn: 'opponent' }));

    if (!opponent.isPassed) {
      // TIMING: Espera 1s antes de acción rival
      await new Promise(resolve => setTimeout(resolve, 1000));
      get().opponentTurnAction();
    } else {
      get().resolveCombatPhase();
    }
  },

  opponentTurnAction: async () => {
    const { opponent, player } = get();
    const availableSlots = opponent.board.filter(slot => slot.card === null);

    if (opponent.hand.length > 0 && availableSlots.length > 0) {
      const cardToPlay = { ...opponent.hand[0], isFaceUp: false };
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

      // 1. Poner carta
      set({
        opponent: { ...currentOpponentState, hand: newHand, board: newBoard },
      });
      
      // TIMING: Espera 0.5s después de jugar para devolver el turno
      await new Promise(resolve => setTimeout(resolve, 500));

      // 2. Cambiar turno
      set({
        turn: player.isPassed ? 'opponent' : 'player'
      });
      
      if (player.isPassed) {
         // Si el jugador ya pasó, la máquina sigue jugando con pausa de 1s
         setTimeout(() => get().opponentTurnAction(), 1000);
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
    if (get().phase === 'combat' || get().phase === 'combat-reveal') return;

    set({ phase: 'combat' });

    setTimeout(() => {
      const currentState = get();
      
      set({
        opponent: {
          ...currentState.opponent,
          board: currentState.opponent.board.map(slot => slot.card ? { ...slot, card: { ...slot.card, isFaceUp: true } } : slot)
        }
      });

      const playerJokers = currentState.player.board.filter(s => s.card?.rank === 'JOKER').length;
      const opponentJokers = currentState.opponent.board.filter(s => s.card?.rank === 'JOKER').length;
      
      if (playerJokers > 0) get().drawCard('player', playerJokers * 2);
      if (opponentJokers > 0) get().drawCard('opponent', opponentJokers * 2);

      setTimeout(() => {
        const { player, opponent } = get();
        const result = calculateCombat(player.board, opponent.board);

        set({ 
            recentDamage: { 
                playerSlots: result.playerEmptySlotsHit, 
                opponentSlots: result.opponentEmptySlotsHit 
            },
            pendingCombatResult: result
        });

        const markDamage = (board: BoardSlot[]) => board.map(slot => {
            if (slot.card && result.deadCardIds.includes(slot.card.id)) {
                return { 
                    ...slot, 
                    card: { ...slot.card, isTakingDamage: true, damageSource: result.damageSources[slot.card.id] } 
                };
            }
            if (slot.card && result.voidedCardIds.includes(slot.card.id)) {
                return { 
                    ...slot, 
                    card: { ...slot.card, isVoided: true, damageSource: result.damageSources[slot.card.id] } 
                };
            }
            return slot;
        });

        set(s => ({
            player: { ...s.player, board: markDamage(s.player.board) },
            opponent: { ...s.opponent, board: markDamage(s.opponent.board) }
        }));

        setTimeout(() => {
             set({ phase: 'combat-reveal' }); 
        }, 300);

      }, 500);

    }, 300);
  },

  finishCombatPhase: () => {
    const currentState = get();
    if (currentState.phase !== 'combat-reveal') return;

    const result = currentState.pendingCombatResult;
    
    if (!result) {
        set({ phase: 'placement' });
        return;
    }

    const clearDead = (board: BoardSlot[]) => board.map(slot => 
        (slot.card?.isTakingDamage || slot.card?.isVoided) ? { ...slot, card: null } : slot
    );

    const newPlayerLives = Math.max(0, currentState.player.lives - result.playerDamageTaken);
    const newOpponentLives = Math.max(0, currentState.opponent.lives - result.opponentDamageTaken);

    set({
        recentDamage: null,
        pendingCombatResult: null,
        player: { ...currentState.player, lives: newPlayerLives, board: clearDead(currentState.player.board), isPassed: false },
        opponent: { ...currentState.opponent, lives: newOpponentLives, board: clearDead(currentState.opponent.board), isPassed: false },
    });

    if (newPlayerLives === 0 || newOpponentLives === 0) {
        set({ phase: 'end' });
        return;
    }

    get().drawCard('player', 2);
    get().drawCard('opponent', 2);
    set({ phase: 'placement', turn: 'player', roundNumber: currentState.roundNumber + 1 });
  }
}));