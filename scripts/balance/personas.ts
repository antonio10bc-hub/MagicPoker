// --- PERFILES DE JUGADOR (bots) ---
// Seis maneras de jugar, de peor a mejor. Todas usan las reglas de verdad; las que
// "piensan" usan el mismo motor de la IA del juego (rankMoves), mirando desde su lado.
//  · novato    · pone lo primero que tiene donde caiga (el rival "fácil" de siempre)
//  · casual    · piensa, pero no siempre elige lo mejor (la IA "normal")
//  · agresivo  · siempre pone la mejor carta que pueda; nunca se planta si puede jugar
//  · prudente  · solo juega si mejora claramente la mesa; se guarda las cartas buenas
//  · experto   · la mejor jugada y se planta cuando conviene (la IA "difícil")
//  · vidente   · (Omnisciente) como el experto, pero ve las cartas ocultas del rival (techo de habilidad)
import { Card, Rank, SealId } from '@/types';
import { chooseOpponentMove, evaluateFight, guessBoards, rankMoves } from '@/lib/ai';
import { ALL_SEALS } from '@/lib/bosses';
import { RANKS } from '@/lib/game-utils';
import { Boon, CastleRun, boonRarity } from '@/lib/castle';
import { Chooser, Move, View } from './engine';

export type PersonaId = 'novato' | 'casual' | 'agresivo' | 'prudente' | 'experto' | 'vidente';
export const PERSONAS: PersonaId[] = ['novato', 'casual', 'agresivo', 'prudente', 'experto', 'vidente'];

export const PERSONA_INFO: Record<PersonaId, { name: string; desc: string; patience: number }> = {
  novato: { name: 'Novato', desc: 'Pone su primera carta en un hueco cualquiera y usa los sellos sin pensar.', patience: 8 },
  casual: { name: 'Casual', desc: 'Piensa la jugada, pero a menudo no elige la mejor.', patience: 12 },
  agresivo: { name: 'Agresivo', desc: 'Siempre pone la mejor carta que puede y nunca se planta mientras pueda jugar.', patience: 15 },
  prudente: { name: 'Prudente', desc: 'Solo juega si mejora claramente la mesa; se guarda las cartas altas.', patience: 15 },
  experto: { name: 'Experto', desc: 'La mejor jugada cada turno y se planta cuando le conviene.', patience: 25 },
  vidente: { name: 'Omnisciente', desc: 'Como el experto pero ve las cartas ocultas del rival: el techo de lo que se puede hacer.', patience: 40 },
};

/** El comodín de sello: se prueba como cada sello posible */
const wildVariants = (hand: Card[], choose: (h: Card[]) => SealId[]): { hand: Card[]; seal?: SealId }[] => {
  const wild = hand.find(c => c.wild);
  if (!wild) return [{ hand }];
  return choose(hand).map(seal => ({ hand: hand.map(c => (c.id === wild.id ? { ...c, wild: false, seal } : c)), seal }));
};

const withWild = (hand: Card[], seal: SealId | undefined, m: { cardId: string; slotIndex: number } | null): Move | null =>
  m && { ...m, ...(seal && hand.find(c => c.id === m.cardId)?.wild ? { wildSeal: seal } : {}) };

/** Lo bien que le va la mesa tal como está (media de lo que imagina) */
const nowScore = (v: View) => {
  const guesses = guessBoards(v.theirs, ctxOf(v));
  return guesses.reduce((n, b) => n + evaluateFight(b, v.mine, ctxOf(v)), 0) / guesses.length;
};

const ctxOf = (v: View) => ({ lives: v.lives, playerLives: v.theirLives, playerPassed: v.theirPassed, unseen: v.unseen });

/** La IA del juego desde el lado del jugador (fácil, normal o difícil) */
const aiPersona = (difficulty: 'easy' | 'normal' | 'hard'): Chooser => v => {
  // El comodín: los que piensan prueban todos los sellos; el novato, uno al azar
  const variants = wildVariants(v.hand, () => (difficulty === 'easy' ? [ALL_SEALS[Math.floor(Math.random() * ALL_SEALS.length)]] : ALL_SEALS));
  if (variants.length === 1) {
    const m = chooseOpponentMove(variants[0].hand, v.mine, v.theirs, difficulty, Math.random, ctxOf(v));
    return withWild(v.hand, variants[0].seal, m);
  }
  // Con comodín: la mejor de todas las variantes (puntuada con el mismo motor)
  let best: { m: Move; score: number } | null = null;
  for (const { hand, seal } of variants) {
    const top = rankMoves(hand, v.mine, v.theirs, ctxOf(v))[0];
    if (top && (!best || top.score > best.score)) best = { m: withWild(v.hand, seal, top)!, score: top.score };
  }
  if (!best) return null;
  if (difficulty === 'hard' && best.score < nowScore(v)) return null;
  return best.m;
};

/** Agresivo: la mejor jugada siempre que haya alguna (no se planta) */
const aggressive: Chooser = v => {
  let best: { m: Move; score: number } | null = null;
  for (const { hand, seal } of wildVariants(v.hand, () => ALL_SEALS)) {
    // Prefiere poner cartas: sin coste por gastar las buenas
    const moves = rankMoves(hand, v.mine, v.theirs, ctxOf(v)).map(c => {
      const card = hand.find(h => h.id === c.cardId)!;
      return { ...c, score: c.score + (card.rank === 'SEAL' ? 0 : 0.3 * card.value) };
    }).sort((a, b) => b.score - a.score);
    if (moves[0] && (!best || moves[0].score > best.score)) best = { m: withWild(v.hand, seal, moves[0])!, score: moves[0].score };
  }
  return best?.m ?? null;
};

/** Prudente: gastar cuesta el doble y solo juega si mejora la mesa en algo claro */
const cautious: Chooser = v => {
  const now = nowScore(v);
  let best: { m: Move; score: number } | null = null;
  for (const { hand, seal } of wildVariants(v.hand, () => ALL_SEALS)) {
    const moves = rankMoves(hand, v.mine, v.theirs, ctxOf(v)).map(c => {
      const card = hand.find(h => h.id === c.cardId)!;
      return { ...c, score: c.score - (card.rank === 'SEAL' ? 0 : 0.3 * card.value) };
    }).sort((a, b) => b.score - a.score);
    if (moves[0] && (!best || moves[0].score > best.score)) best = { m: withWild(v.hand, seal, moves[0])!, score: moves[0].score };
  }
  if (!best) return null;
  // Abrir con la mesa vacía no se puede evitar del todo: si no tiene nada puesto, juega
  const empty = v.mine.every(s => !s.card);
  if (!empty && best.score < now + 2) return null;
  return best.m;
};

export const chooserOf = (p: PersonaId): Chooser => {
  switch (p) {
    case 'novato': return aiPersona('easy');
    case 'casual': return aiPersona('normal');
    case 'agresivo': return aggressive;
    case 'prudente': return cautious;
    case 'experto': return aiPersona('hard');
    case 'vidente': return aiPersona('hard');
  }
};
export const seesAll = (p: PersonaId) => p === 'vidente';

// --- MEJORAS DEL CASTILLO: cuál elige cada uno ---
const cardWorth: Partial<Record<Rank | 'WILD', number>> = {
  DRAGON: 12, PHOENIX: 10, HYDRA: 9, KNIGHT: 5, PRIESTESS: 5, WILD: 5, TOWER: 4, JESTER: 3, BOMB: 3, SPY: 2,
};

export const boonScore = (p: PersonaId, run: CastleRun, b: Boon): number => {
  const missing = run.maxLives - run.lives;
  switch (b.kind) {
    case 'heal': return missing * (p === 'prudente' ? 4 : 3);
    case 'maxLife': return p === 'prudente' ? 7 : 6;
    case 'card': return cardWorth[b.rank] ?? 3;
    case 'seal': {
      const target = run.deck[b.target];
      return 3 + (target ? RANKS[target.rank].value / 4 : 0);
    }
    case 'upgrade': return 3.5;
    case 'purge': return 2.5;
    case 'pact': return p === 'agresivo' ? 5 : run.lives >= 4 ? 1.5 : -5;
  }
};

/** Elige una mejora de la oferta */
export const pickBoon = (p: PersonaId, run: CastleRun, offer: Boon[]): number => {
  if (offer.length === 0) return -1;
  if (p === 'novato') return Math.floor(Math.random() * offer.length);
  if (p === 'casual') {
    const heal = offer.findIndex(b => b.kind === 'heal');
    if (heal >= 0 && run.lives <= run.maxLives - 2) return heal;
    // Le tira lo raro y lo legendario; si no, al azar
    const shiny = offer.findIndex(b => boonRarity(b) !== 'common');
    return shiny >= 0 && Math.random() < 0.6 ? shiny : Math.floor(Math.random() * offer.length);
  }
  let best = 0;
  offer.forEach((b, i) => { if (boonScore(p, run, b) > boonScore(p, run, offer[best])) best = i; });
  return best;
};
