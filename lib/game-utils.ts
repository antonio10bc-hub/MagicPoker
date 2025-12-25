import { Card, Suit, Rank } from "@/types";

// Generar un ID único simple
const generateId = () => Math.random().toString(36).substr(2, 9);

// Valores de poder para comparar (A es el más alto en Poker, pero aquí tiene efecto especial, le damos valor bajo para combate normal o alto?
// En tu reglas: "Gana la carta más alta". Asumiremos: 2 < 3 ... < K < A. 
// PERO: El AS tiene efecto especial de limpiar tablero. Lo manejaremos en la lógica de resolución.
const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14, 'JOKER': 15 // Joker gana a todo en fuerza bruta si no hay efecto
};

export const createDeck = (owner: 'player' | 'opponent'): Card[] => {
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  
  let deck: Card[] = [];

  // Crear cartas normales
  suits.forEach(suit => {
    ranks.forEach(rank => {
      deck.push({
        id: generateId(),
        rank,
        suit,
        value: RANK_VALUES[rank],
        isFaceUp: false,
        owner
      });
    });
  });

  // Añadir Joker (1 por mazo según tus reglas)
  deck.push({
    id: generateId(),
    rank: 'JOKER',
    suit: 'joker',
    value: 15,
    isFaceUp: false,
    owner
  });

  return shuffle(deck);
};

export const shuffle = (array: any[]) => {
  return array.sort(() => Math.random() - 0.5);
};

// Lógica de combate singular (Carta vs Carta)
export const resolveClash = (card1: Card, card2: Card): { winner: Card | null, loser: Card | null } => {
  if (card1.value > card2.value) return { winner: card1, loser: card2 };
  if (card2.value > card1.value) return { winner: card2, loser: card1 };
  return { winner: null, loser: null }; // Empate, ambas mueren
};