import { create } from 'zustand';
import { BoardSlot, PlayerState, GamePhase, DamageEvent, CombatResult } from '@/types';
// NUEVO: Importar getCardValue
import { createDeck, calculateCombat, getCardValue } from '@/lib/game-utils';
import { playSound } from '@/lib/sounds';

// NUEVO: Tipos para menú y dificultad
type Difficulty = 'easy' | 'normal' | 'hard';
type Screen = 'menu' | 'game';

interface GameState {
  screen: Screen;          // NUEVO
  difficulty: Difficulty;  // NUEVO
  phase: GamePhase;
  turn: 'player' | 'opponent';
  player: PlayerState;
  opponent: PlayerState;
  roundNumber: number;
  recentDamage: DamageEvent | null;
  pendingCombatResult: CombatResult | null;
  gameResult: 'win' | 'loss' | 'draw' | null;

  // Acciones nuevas
  setDifficulty: (diff: Difficulty) => void;
  goToMenu: () => void;
  
  startGame: () => void;
  resetGame: () => void;
  placeCard: (cardId: string, slotIndex: number) => void;
  passTurn: () => Promise<void>;
  opponentTurnAction: () => Promise<void>;
  resolveCombatPhase: () => void;
  finishCombatPhase: () => void;
  drawCard: (target: 'player' | 'opponent', amount?: number) => void;
}

const INITIAL_SLOTS: BoardSlot[] = [0, 1, 2, 3].map(i => ({ index: i as 0|1|2|3, card: null }));

const getInitialPlayerState = (): PlayerState => ({
    lives: 4, hand: [], board: JSON.parse(JSON.stringify(INITIAL_SLOTS)), deck: [], isPassed: false 
});

export const useGameStore = create<GameState>((set, get) => ({
  screen: 'menu',       // Empezamos en menú
  difficulty: 'normal', // Dificultad por defecto
  phase: 'start',
  turn: 'player',
  roundNumber: 1,
  recentDamage: null,
  pendingCombatResult: null,
  gameResult: null,
  
  player: getInitialPlayerState(),
  opponent: getInitialPlayerState(),

  // NUEVO: Actions para menú
  setDifficulty: (diff) => set({ difficulty: diff }),
  goToMenu: () => set({ screen: 'menu' }),

  startGame: () => {
    playSound('shuffle', 0.6);

    const playerDeckFull = createDeck('player');
    const opponentDeckFull = createDeck('opponent');

    // Barajar
    // playerDeckFull.sort(() => Math.random() - 0.5); // Ya lo hace createDeck
    // opponentDeckFull.sort(() => Math.random() - 0.5);

    const playerHand = playerDeckFull.slice(0, 3).map(c => ({ ...c, isFaceUp: true }));
    const playerDeck = playerDeckFull.slice(3);
    
    const opponentHand = opponentDeckFull.slice(0, 3);
    const opponentDeck = opponentDeckFull.slice(3);

    set({
      screen: 'game', // Al iniciar, vamos al juego
      phase: 'placement',
      turn: 'player',
      roundNumber: 1,
      recentDamage: null,
      pendingCombatResult: null,
      gameResult: null,
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
        gameResult: null,
        player: getInitialPlayerState(),
        opponent: getInitialPlayerState(),
    });
    // Si estamos en pantalla de juego, reiniciamos directo. Si estamos en menú, no hacemos nada.
    if (get().screen === 'game') {
        get().startGame();
    }
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
      setTimeout(() => get().opponentTurnAction(), 1000);
    } else {
      set({ turn: 'player' });
    }
  },

  passTurn: async () => {
    const { opponent } = get();
    set(state => ({ player: { ...state.player, isPassed: true }, turn: 'opponent' }));

    if (!opponent.isPassed) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      get().opponentTurnAction();
    } else {
      get().resolveCombatPhase();
    }
  },

  // --- IA CON DIFICULTAD ---
  opponentTurnAction: async () => {
    const { opponent, player, difficulty } = get(); // Leemos dificultad
    const availableSlots = opponent.board.filter(slot => slot.card === null);

    if (opponent.hand.length > 0 && availableSlots.length > 0) {
      const cardToPlay = { ...opponent.hand[0], isFaceUp: false };
      let chosenSlotIndex = availableSlots[0].index;
      
      const defensiveSlots = availableSlots.filter(s => player.board[s.index].card !== null);
      
      // LÓGICA POR DIFICULTAD
      if (difficulty === 'easy') {
          // FÁCIL: 100% Aleatorio
          chosenSlotIndex = availableSlots[Math.floor(Math.random() * availableSlots.length)].index;
      } 
      else if (difficulty === 'normal') {
          // NORMAL: 30% Defensivo, 70% Aleatorio
          if (defensiveSlots.length > 0 && Math.random() > 0.7) {
             chosenSlotIndex = defensiveSlots[Math.floor(Math.random() * defensiveSlots.length)].index;
          } else {
             chosenSlotIndex = availableSlots[Math.floor(Math.random() * availableSlots.length)].index;
          }
      } 
      else if (difficulty === 'hard') {
          // DIFÍCIL: Busca ganar intercambios o bloquear
          let bestMoveFound = false;
          // Busca carta rival a la que ganemos
          for (const slot of defensiveSlots) {
              const playerCard = player.board[slot.index].card;
              if (playerCard) {
                  const myVal = getCardValue(cardToPlay.rank);
                  const oppVal = getCardValue(playerCard.rank);
                  // Si mi carta es mayor, la pongo ahí para matar
                  if (myVal > oppVal) {
                      chosenSlotIndex = slot.index;
                      bestMoveFound = true;
                      break;
                  }
              }
          }
          // Si no gano a nadie, intento al menos bloquear (empate o perder pero bloquear daño)
          if (!bestMoveFound && defensiveSlots.length > 0) {
               chosenSlotIndex = defensiveSlots[Math.floor(Math.random() * defensiveSlots.length)].index;
          } else if (!bestMoveFound) {
               // Si no hay nada que bloquear, aleatorio
               chosenSlotIndex = availableSlots[Math.floor(Math.random() * availableSlots.length)].index;
          }
      }

      const currentOpponentState = get().opponent;
      const newHand = currentOpponentState.hand.filter(c => c.id !== cardToPlay.id);
      const newBoard = [...currentOpponentState.board];
      newBoard[chosenSlotIndex] = { ...newBoard[chosenSlotIndex], card: cardToPlay };

      playSound('click', 0.4); // Sonido carta rival

      set({
        opponent: { ...currentOpponentState, hand: newHand, board: newBoard },
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));

      set({
        turn: player.isPassed ? 'opponent' : 'player'
      });
      
      if (player.isPassed) {
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

    const finalPlayerBoard = clearDead(currentState.player.board);
    const finalOpponentBoard = clearDead(currentState.opponent.board);
    const playerDeck = currentState.player.deck;
    const playerHand = currentState.player.hand;
    const opponentDeck = currentState.opponent.deck;
    const opponentHand = currentState.opponent.hand;

    const playerRunOut = playerDeck.length === 0 && playerHand.length === 0 && finalPlayerBoard.every(s => s.card === null);
    const opponentRunOut = opponentDeck.length === 0 && opponentHand.length === 0 && finalOpponentBoard.every(s => s.card === null);
    const playerHasBoard = finalPlayerBoard.some(s => s.card !== null);
    const opponentHasBoard = finalOpponentBoard.some(s => s.card !== null);

    let finalPhase: GamePhase = 'placement';
    let resultType: 'win' | 'loss' | 'draw' | null = null;

    if (newPlayerLives === 0 && newOpponentLives === 0) {
        finalPhase = 'end'; resultType = 'draw';
    } else if (newPlayerLives === 0) {
        finalPhase = 'end'; resultType = 'loss';
    } else if (newOpponentLives === 0) {
        finalPhase = 'end'; resultType = 'win';
    } 
    else if (playerRunOut && opponentRunOut) {
        finalPhase = 'end'; resultType = 'draw';
    } else if (playerRunOut && opponentHasBoard) {
        finalPhase = 'end'; resultType = 'loss';
    } else if (opponentRunOut && playerHasBoard) {
        finalPhase = 'end'; resultType = 'win';
    }

    // SFX: Sonidos de final de partida
    if (finalPhase === 'end') {
        if (resultType === 'win') playSound('victory', 0.8);
        if (resultType === 'loss') playSound('defeat', 0.8);
    }

    set({
        recentDamage: null,
        pendingCombatResult: null,
        gameResult: resultType,
        phase: finalPhase,
        player: { ...currentState.player, lives: newPlayerLives, board: finalPlayerBoard, isPassed: false },
        opponent: { ...currentState.opponent, lives: newOpponentLives, board: finalOpponentBoard, isPassed: false },
    });

    if (finalPhase === 'end') return;

    get().drawCard('player', 2);
    get().drawCard('opponent', 2);
    set({ turn: 'player', roundNumber: currentState.roundNumber + 1 });
  }
}));