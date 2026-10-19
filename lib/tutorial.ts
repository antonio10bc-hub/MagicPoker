// --- TUTORIAL GUIADO ---
// Una partida guionizada que enseña todas las mecánicas en pocos pasos y siempre se
// gana. Los mazos están ordenados, el rival juega lo que dice el guion y el Príncipe
// (J) elige el objetivo previsto. Las reglas son las de siempre (lib/game-utils).
//
//  Ronda 1 · cartas normales: cara a cara gana el más alto; contra un hueco vacío,
//            daño directo. El rival castiga tus huecos vacíos.
//  Ronda 2 · el Joker (no ataca, roba 2) y el Príncipe (golpea uno al azar).
//  Ronda 3 · el rival enseña Rey y Reina: parece que pierdes… y el As lo anula todo.
//  Ronda 4 · rematas al rival y ganas.
import { BoardSlot, Card, Owner, PlayerState, Rank, Rng } from '@/types';
import { getTargetIndices, playCardToSlot, RANKS } from '@/lib/game-utils';
import { STARTING_LIVES } from '@/lib/constants';
import type { Translations } from '@/lib/i18n';

export interface TutorialMove { rank: Rank; slot: number; faceUp?: boolean }

type Text = keyof Translations;

export type TutorialStep =
  /** Explicación: espera a que pulses "Entendido" */
  | { kind: 'info'; text: Text }
  /** Juega esta carta en este hueco (lo demás queda bloqueado); luego responde el rival */
  | { kind: 'play'; rank: Rank; slot: number; text: Text; rival?: TutorialMove[] }
  /** Plántate; el rival juega lo que le quede */
  | { kind: 'stand'; text: Text; rival?: TutorialMove[] }
  /** Repaso de la pelea (con el resultado a la vista); "Continuar" sigue */
  | { kind: 'review'; text: Text };

export const TUTORIAL_STEPS: TutorialStep[] = [
  // Ronda 1
  { kind: 'info', text: 'tut_welcome' },
  { kind: 'play', rank: '9', slot: 1, text: 'tut_play_9', rival: [{ rank: '6', slot: 1 }] },
  { kind: 'info', text: 'tut_facedown' },
  { kind: 'play', rank: '7', slot: 3, text: 'tut_play_7', rival: [{ rank: '4', slot: 0 }] },
  { kind: 'info', text: 'tut_threat' },
  { kind: 'stand', text: 'tut_stand', rival: [{ rank: '3', slot: 2 }] },
  { kind: 'review', text: 'tut_review_1' },
  // Ronda 2
  { kind: 'info', text: 'tut_specials' },
  { kind: 'play', rank: 'JOKER', slot: 0, text: 'tut_play_joker' },
  { kind: 'play', rank: 'J', slot: 2, text: 'tut_play_jack' },
  { kind: 'stand', text: 'tut_stand_2' },
  { kind: 'review', text: 'tut_review_2' },
  // Ronda 3 (el rival abre con Rey y Reina a la vista)
  { kind: 'info', text: 'tut_danger' },
  { kind: 'play', rank: 'A', slot: 0, text: 'tut_play_ace' },
  { kind: 'stand', text: 'tut_stand_3' },
  { kind: 'review', text: 'tut_review_3' },
  // Ronda 4
  { kind: 'play', rank: '10', slot: 0, text: 'tut_play_10', rival: [{ rank: '5', slot: 0 }] },
  { kind: 'play', rank: '6', slot: 2, text: 'tut_play_6' },
  { kind: 'stand', text: 'tut_stand_4' },
  { kind: 'review', text: 'tut_review_4' },
];

/** Jugadas del rival al empezar cada ronda (antes de tu turno), por número de ronda */
export const TUTORIAL_OPENINGS: Record<number, TutorialMove[]> = {
  3: [{ rank: 'K', slot: 2, faceUp: true }, { rank: 'Q', slot: 1, faceUp: true }],
};

/** En la ronda 2 el Príncipe golpea al 3 que tiene delante */
const JACK_TARGETS: Record<number, number> = { 2: 2 };

// --- MAZOS ORDENADOS ---
const PLAYER_HAND: Rank[] = ['9', '7', '3'];
const PLAYER_DECK: Rank[] = ['J', 'JOKER', 'A', '2', '10', '6', '8', '5', '4'];
const RIVAL_HAND: Rank[] = ['6', '4', '3'];
const RIVAL_DECK: Rank[] = ['K', 'Q', '5', '2', '8', '9', '7'];

const makeCards = (owner: Owner, ranks: Rank[], faceUp: boolean, from: number): Card[] =>
  ranks.map((rank, i) => ({
    id: `${owner}-${rank}-tut${from + i}`, rank, owner, value: RANKS[rank].value,
    suit: rank === 'JOKER' ? 'joker' : 'standard', isFaceUp: faceUp,
  }));

const emptyBoard = (): BoardSlot[] => [0, 1, 2, 3].map(index => ({ index, card: null }));

export const tutorialPlayers = (): { player: PlayerState; opponent: PlayerState } => ({
  player: { lives: STARTING_LIVES, hand: makeCards('player', PLAYER_HAND, true, 0), deck: makeCards('player', PLAYER_DECK, false, 10), board: emptyBoard(), isPassed: false },
  opponent: { lives: STARTING_LIVES, hand: makeCards('opponent', RIVAL_HAND, false, 0), deck: makeCards('opponent', RIVAL_DECK, false, 10), board: emptyBoard(), isPassed: false },
});

/** El rival juega las cartas del guion (por rango) en los huecos indicados */
export const applyRivalMoves = (rival: PlayerState, moves: TutorialMove[] = []): PlayerState =>
  moves.reduce((state, m) => {
    const card = state.hand.find(c => c.rank === m.rank);
    return (card && playCardToSlot(state, card.id, m.slot, !!m.faceUp)) || state;
  }, rival);

/** Carta de la mano que pide el paso actual */
export const stepCard = (hand: Card[], step: TutorialStep | undefined): Card | undefined =>
  step?.kind === 'play' ? hand.find(c => c.rank === step.rank) : undefined;

/**
 * Azar de la pelea en el tutorial: el Príncipe elige el objetivo del guion. El resto
 * de cartas no usan el azar.
 */
export const tutorialRng = (playerBoard: BoardSlot[], round: number): Rng => {
  const target = JACK_TARGETS[round];
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
