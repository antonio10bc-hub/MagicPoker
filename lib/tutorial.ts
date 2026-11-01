// --- TUTORIAL GUIADO ---
// Partidas guionizadas con las reglas de siempre (lib/game-utils): los mazos están
// ordenados, el rival juega lo que dice el guion y el Príncipe (J) elige el objetivo
// previsto. Hay varios guiones (ver SCRIPTS):
//  · Las lecciones del prólogo: un solo turno contra el ente, una carta cada una (el 6,
//    el Príncipe, la Reina, el Rey, el Joker y el As). Mientras enseña, el ente no te
//    hace daño, y al cerrar el repaso de la pelea se vuelve al mapa.
//  · El duelo final contra el ente: dos rondas que enseñan los huecos vacíos y a
//    plantarse, y siempre se ganan.
//  · La partida completa de antes ("full"), para Repetir tutorial desde Ajustes:
//      Ronda 1 · cartas normales: cara a cara gana el más alto; contra un hueco vacío,
//                daño directo. El rival castiga tus huecos vacíos.
//      Ronda 2 · el Joker (no ataca, roba 2) y el Príncipe (golpea uno al azar).
//      Ronda 3 · el rival enseña Rey y Reina: parece que pierdes… y el As lo anula todo.
//      Ronda 4 · un golpe directo y ganas.
import { BoardSlot, Card, Owner, PlayerState, Rank, Rng } from '@/types';
import { getTargetIndices, playCardToSlot, RANKS } from '@/lib/game-utils';
import { STARTING_LIVES } from '@/lib/constants';
import type { Translations } from '@/lib/i18n';

export interface TutorialMove { rank: Rank; slot: number; faceUp?: boolean }

type Text = keyof Translations;

export type TutorialStep =
  /** Juega esta carta en este hueco (lo demás queda bloqueado); luego responde el rival */
  | { kind: 'play'; rank: Rank; slot: number; text: Text; rival?: TutorialMove[] }
  /** Plántate; el rival juega lo que le quede */
  | { kind: 'stand'; text: Text; rival?: TutorialMove[] }
  /** Repaso de la pelea (con el resultado a la vista); "Continuar" sigue */
  | { kind: 'review'; text: Text }
  /** Explicación antes de jugar (sin pelea); "Continuar" sigue */
  | { kind: 'note'; text: Text };

const FULL_STEPS: TutorialStep[] = [
  // Ronda 1: choque cara a cara, golpe directo y huecos amenazados
  { kind: 'play', rank: '9', slot: 1, text: 'tut_play_9', rival: [{ rank: '6', slot: 1 }] },
  { kind: 'play', rank: '7', slot: 3, text: 'tut_play_7', rival: [{ rank: '4', slot: 0 }] },
  { kind: 'stand', text: 'tut_stand', rival: [{ rank: '3', slot: 2 }] },
  { kind: 'review', text: 'tut_review_1' },
  // Ronda 2: Joker y Príncipe
  { kind: 'play', rank: 'JOKER', slot: 0, text: 'tut_play_joker' },
  // El Príncipe en dos pasos: primero qué hace, luego dónde ponerlo
  { kind: 'note', text: 'tut_jack_info' },
  { kind: 'play', rank: 'J', slot: 2, text: 'tut_play_jack' },
  { kind: 'stand', text: 'tut_stand_2' },
  { kind: 'review', text: 'tut_review_2' },
  // Ronda 3: el rival abre con Rey y Reina a la vista… y el As lo anula todo
  { kind: 'play', rank: 'A', slot: 0, text: 'tut_play_ace' },
  { kind: 'stand', text: 'tut_stand_3' },
  { kind: 'review', text: 'tut_review_3' },
  // Ronda 4: un golpe directo para ganar (el cierre lo cuenta la pantalla final)
  { kind: 'play', rank: '6', slot: 2, text: 'tut_play_6' },
  { kind: 'stand', text: 'tut_stand_4' },
];

// --- LOS GUIONES ---
export type TutorialId = 'full' | 'number' | 'jack' | 'queen' | 'king' | 'joker' | 'ace' | 'duel';
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
  /** Lección de un turno: sin daño para ti y, tras el repaso, de vuelta al mapa */
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
  // El 6 contra su 4: cara a cara gana el mayor (y cómo se pelea: plantándose)
  number: lesson('6', 1, 'les_number_play', 'les_number_review', [{ rank: '4', slot: 1 }]),
  // El Príncipe: uno de los 3 de delante, al azar (esta vez, su 5)
  jack: lesson('J', 1, 'les_jack_play', 'les_jack_review', [{ rank: '5', slot: 2 }], { jackTargets: { 1: 2 } }),
  // La Reina: los dos de los lados de enfrente a la vez
  queen: lesson('Q', 1, 'les_queen_play', 'les_queen_review', [{ rank: '7', slot: 0 }, { rank: '8', slot: 2 }]),
  // El Rey: los 3 de delante a la vez
  king: lesson('K', 1, 'les_king_play', 'les_king_review', [{ rank: '4', slot: 0 }, { rank: '9', slot: 1 }, { rank: '6', slot: 2 }]),
  // El Joker: no ataca; al revelarse, 2 cartas más
  joker: lesson('JOKER', 1, 'les_joker_play', 'les_joker_review', [], { player: { hand: ['JOKER'], deck: ['8', '5', '2'] } }),
  // El As: limpia todo el tablero, también tus cartas (tu 9)
  ace: lesson('A', 3, 'les_ace_play', 'les_ace_review', [{ rank: 'K', slot: 1 }, { rank: 'Q', slot: 2 }],
    { player: { hand: ['A'], deck: ['2', '3'], board: [{ rank: '9', slot: 0 }] } }),
  // El duelo: huecos vacíos (te castiga), taparlos y ganar
  duel: {
    steps: [
      { kind: 'play', rank: '9', slot: 1, text: 'duel_play_9', rival: [{ rank: '6', slot: 1 }] },
      { kind: 'play', rank: '7', slot: 3, text: 'duel_play_7', rival: [{ rank: '4', slot: 0 }] },
      { kind: 'stand', text: 'duel_stand', rival: [{ rank: '3', slot: 2 }] },
      { kind: 'review', text: 'duel_review' },
      { kind: 'play', rank: '10', slot: 0, text: 'duel_play_10' },
      { kind: 'play', rank: '8', slot: 2, text: 'duel_play_8' },
      { kind: 'stand', text: 'duel_stand_2' },
    ],
    player: { hand: ['9', '7', '3'], deck: ['10', '8', '2', '5', '4', '6'] },
    rival: { hand: ['6', '4', '3'], deck: ['2', '5', '8', '9', '7'], lives: 2 },
  },
  full: {
    steps: FULL_STEPS,
    player: { hand: ['9', '7', '3'], deck: ['J', 'JOKER', 'A', '2', '10', '6', '8', '5', '4'] },
    rival: { hand: ['6', '4', '3'], deck: ['K', 'Q', '5', '2', '8', '9', '7'] },
    openings: { 3: [{ rank: 'K', slot: 2, faceUp: true }, { rank: 'Q', slot: 1, faceUp: true }] },
    jackTargets: { 2: 2 },
  },
};

/** Los pasos de un guion (el de antes, si no se dice) */
export const stepsOf = (id: TutorialId = 'full') => SCRIPTS[id].steps;
/** Compatibilidad: los pasos de la partida completa */
export const TUTORIAL_STEPS = FULL_STEPS;

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

export const tutorialPlayers = (id: TutorialId = 'full'): { player: PlayerState; opponent: PlayerState } => ({
  player: sideState('player', SCRIPTS[id].player),
  opponent: sideState('opponent', SCRIPTS[id].rival),
});

/** Jugadas del rival al abrir una ronda */
export const tutorialOpening = (id: TutorialId, round: number) => SCRIPTS[id].openings?.[round];

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
export const tutorialRng = (playerBoard: BoardSlot[], round: number, id: TutorialId = 'full'): Rng => {
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
