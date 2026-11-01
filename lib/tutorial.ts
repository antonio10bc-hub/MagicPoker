// --- TUTORIAL GUIADO ---
// Partidas guionizadas con las reglas de siempre (lib/game-utils): los mazos están
// ordenados, el rival juega lo que dice el guion y el Príncipe (J) elige el objetivo
// previsto. Hay varios guiones (ver SCRIPTS):
//  · Las lecciones del prólogo: un solo turno contra el ente, una carta cada una (el 6,
//    el Príncipe, la Reina, el Rey, el Joker y el As). Sus cartas también te golpean
//    (así se entiende), y al cerrar el repaso de la pelea se vuelve al mapa.
//  · El duelo final contra el ente: una ronda guiada (los huecos vacíos castigan) y
//    luego libre: lo cierras tú. Es también lo que juega Ajustes → Repetir tutorial.
import { BoardSlot, Card, Owner, PlayerState, Rank, Rng } from '@/types';
import { getTargetIndices, playCardToSlot, RANKS } from '@/lib/game-utils';
import { STARTING_LIVES } from '@/lib/constants';
import type { Translations } from '@/lib/i18n';

/** Jugada del rival. `slot: -1`: frente a la carta que acabas de poner */
export interface TutorialMove { rank: Rank; slot: number; faceUp?: boolean }

type Text = keyof Translations;

export type TutorialStep =
  /** Juega esta carta en este hueco (sin hueco: en el que quieras); luego responde el rival */
  | { kind: 'play'; rank: Rank; slot?: number; text: Text; rival?: TutorialMove[] }
  /** Plántate; el rival juega lo que le quede */
  | { kind: 'stand'; text: Text; rival?: TutorialMove[] }
  /** Repaso de la pelea (con el resultado a la vista); "Continuar" sigue */
  | { kind: 'review'; text: Text }
  /** Explicación antes de jugar (sin pelea); "Continuar" sigue */
  | { kind: 'note'; text: Text }
  /** A partir de aquí, libre: juegas como quieras (el rival también) hasta el final */
  | { kind: 'free'; text: Text };


// --- LOS GUIONES ---
export type TutorialId = 'number' | 'jack' | 'queen' | 'king' | 'joker' | 'ace' | 'duel';
/** Las lecciones del prólogo, en orden (después, el duelo) */
export const LESSONS: TutorialId[] = ['number', 'jack', 'queen', 'king', 'joker', 'ace'];

interface Side {
  hand: Rank[];
  deck: Rank[];
  /** Cartas ya en la mesa al empezar (boca arriba) */
  board?: TutorialMove[];
  lives?: number;
}
export interface TutorialScript {
  steps: TutorialStep[];
  player: Side;
  rival: Side;
  /** Jugadas del rival al empezar cada ronda (antes de tu turno), por número de ronda */
  openings?: Record<number, TutorialMove[]>;
  /** A quién golpea el Príncipe en cada ronda */
  jackTargets?: Record<number, number>;
  /** Lección de un turno: tras el repaso, de vuelta al mapa */
  lesson?: boolean;
}

const STAND: TutorialStep = { kind: 'stand', text: 'les_stand' };
/** Una lección: pon la carta en su hueco, plántate y mira qué pasa */
const lesson = (rank: Rank, slot: number, play: Text, review: Text, rival: TutorialMove[], extra: Partial<TutorialScript> = {}): TutorialScript => ({
  steps: [{ kind: 'play', rank, slot, text: play }, STAND, { kind: 'review', text: review }],
  player: { hand: [rank], deck: ['2', '3', '4'], ...extra.player },
  rival: { hand: ['2'], deck: ['3', '4'], board: rival.map(m => ({ ...m, faceUp: true })), ...extra.rival },
  lesson: true,
  ...(extra.jackTargets ? { jackTargets: extra.jackTargets } : {}),
});

export const SCRIPTS: Record<TutorialId, TutorialScript> = {
  // Lo básico: con la mesa vacía, pon tu carta donde quieras; el ente pone su 4 enfrente;
  // te plantas y cara a cara gana el mayor
  number: {
    steps: [
      { kind: 'play', rank: '6', text: 'les_number_place', rival: [{ rank: '4', slot: -1, faceUp: true }] },
      { kind: 'stand', text: 'les_number_play' },
      { kind: 'review', text: 'les_number_review' },
    ],
    player: { hand: ['6'], deck: ['2', '3', '4'] },
    rival: { hand: ['4'], deck: ['2', '3'] },
    lesson: true,
  },
  // El Príncipe: uno de los 3 de delante, al azar (esta vez, su 5… que a ti sí te da)
  jack: lesson('J', 1, 'les_jack_play', 'les_jack_review', [{ rank: '5', slot: 2 }], { jackTargets: { 1: 2 } }),
  // La Reina: los dos de los lados de enfrente a la vez
  queen: lesson('Q', 1, 'les_queen_play', 'les_queen_review', [{ rank: '7', slot: 0 }, { rank: '8', slot: 2 }]),
  // El Rey: los 3 de delante a la vez
  king: lesson('K', 1, 'les_king_play', 'les_king_review', [{ rank: '4', slot: 0 }, { rank: '9', slot: 1 }, { rank: '6', slot: 2 }]),
  // El Joker: no ataca, pero el 5 del ente se estrella contra él (bloquea) y te da 2 cartas
  joker: lesson('JOKER', 1, 'les_joker_play', 'les_joker_review', [{ rank: '5', slot: 1 }], { player: { hand: ['JOKER'], deck: ['8', '5', '2'] } }),
  // El As: limpia todo el tablero, también tus cartas (tu 9)
  ace: lesson('A', 3, 'les_ace_play', 'les_ace_review', [{ rank: 'K', slot: 1 }, { rank: 'Q', slot: 2 }],
    { player: { hand: ['A'], deck: ['2', '3'], board: [{ rank: '9', slot: 0 }] } }),
  // El duelo: una ronda guiada (tu 9 contra su 6, tu 7 al vacío… y sus cartas a tus huecos
  // vacíos) y después libre: acabas tú con él
  duel: {
    steps: [
      { kind: 'play', rank: '9', slot: 1, text: 'duel_play_9' },
      { kind: 'play', rank: '7', slot: 3, text: 'duel_play_7', rival: [{ rank: '4', slot: 0 }] },
      { kind: 'stand', text: 'duel_stand', rival: [{ rank: '3', slot: 2 }] },
      { kind: 'review', text: 'duel_review' },
      { kind: 'free', text: 'duel_free' },
    ],
    player: { hand: ['9', '7', '3'], deck: ['10', '8', 'K', '5', '4', '6', '9', '2'] },
    rival: { hand: ['4', '3'], deck: ['2', '3', '2', '4', '3', '2'], board: [{ rank: '6', slot: 1, faceUp: true }], lives: 2 },
  },
};

/** Los pasos de un guion (el duelo, si no se dice) */
export const stepsOf = (id: TutorialId = 'duel') => SCRIPTS[id].steps;

const makeCards = (owner: Owner, ranks: Rank[], faceUp: boolean, from: number): Card[] =>
  ranks.map((rank, i) => ({
    id: `${owner}-${rank}-tut${from + i}`, rank, owner, value: RANKS[rank].value,
    suit: rank === 'JOKER' ? 'joker' : 'standard', isFaceUp: faceUp,
  }));

const boardOf = (owner: Owner, moves: TutorialMove[] = []): BoardSlot[] => {
  const cards = makeCards(owner, moves.map(m => m.rank), true, 50);
  return [0, 1, 2, 3].map(index => ({ index, card: cards[moves.findIndex(m => m.slot === index)] ?? null }));
};

const sideState = (owner: Owner, side: Side): PlayerState => ({
  lives: side.lives ?? STARTING_LIVES,
  ...(side.lives ? { maxLives: side.lives } : {}),
  hand: makeCards(owner, side.hand, owner === 'player', 0),
  deck: makeCards(owner, side.deck, false, 10),
  board: boardOf(owner, side.board),
  isPassed: false,
});

export const tutorialPlayers = (id: TutorialId = 'duel'): { player: PlayerState; opponent: PlayerState } => ({
  player: sideState('player', SCRIPTS[id].player),
  opponent: sideState('opponent', SCRIPTS[id].rival),
});

/** Jugadas del rival al abrir una ronda */
export const tutorialOpening = (id: TutorialId, round: number) => SCRIPTS[id].openings?.[round];

/** El rival juega las cartas del guion (por rango) en los huecos indicados (-1: frente
 *  a `front`, el hueco donde acabas de jugar) */
export const applyRivalMoves = (rival: PlayerState, moves: TutorialMove[] = [], front = 0): PlayerState =>
  moves.reduce((state, m) => {
    const card = state.hand.find(c => c.rank === m.rank);
    return (card && playCardToSlot(state, card.id, m.slot < 0 ? front : m.slot, !!m.faceUp)) || state;
  }, rival);

/** Carta de la mano que pide el paso actual */
export const stepCard = (hand: Card[], step: TutorialStep | undefined): Card | undefined =>
  step?.kind === 'play' ? hand.find(c => c.rank === step.rank) : undefined;

/**
 * Azar de la pelea en el tutorial: el Príncipe elige el objetivo del guion. El resto
 * de cartas no usan el azar.
 */
export const tutorialRng = (playerBoard: BoardSlot[], round: number, id: TutorialId = 'duel'): Rng => {
  const target = SCRIPTS[id].jackTargets?.[round];
  const jack = playerBoard.find(s => s.card?.rank === 'J');
  if (target === undefined || !jack) return () => 0;
  const targets = getTargetIndices(jack.index, 'J');
  const i = Math.max(0, targets.indexOf(target));
  return () => (i + 0.5) / targets.length;
};

const DONE_KEY = 'magic_poker_tutorial_done';
export const isTutorialDone = () => {
  try { return localStorage.getItem(DONE_KEY) === '1'; } catch { return true; }
};
export const markTutorialDone = () => {
  try { localStorage.setItem(DONE_KEY, '1'); } catch { /* sin almacenamiento */ }
};
