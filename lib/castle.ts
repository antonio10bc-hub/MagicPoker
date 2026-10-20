// --- EL CASTILLO (roguelike) ---
// Se abre al vencer al jefe secreto. Es una subida por todos los jefes, uno tras otro
// y evolucionados, con tu mazo del editor. Las vidas se arrastran de pelea en pelea.
// Entre jefe y jefe eliges 1 de 3 mejoras sacadas de una bolsa (curarte y una carta
// nueva casi siempre están). Si caes, la subida se acaba y se empieza de cero.
import { Card, Rank, Rng, SealId } from '@/types';
import { CASTLE_RANKS, createCard, createSealCard, createWildSealCard, DECK_RANKS, RANKS, shuffle } from '@/lib/game-utils';
import { ALL_SEALS, BOSSES } from '@/lib/bosses';
import { defaultDeckConfig, getDeckConfig, sanitizeDeckConfig } from '@/lib/deck';
import { STARTING_LIVES } from '@/lib/constants';

/** Una carta del mazo de la subida (se crea de nuevo en cada pelea) */
export interface CardTemplate {
  rank: Rank;
  /** Sello: en una carta de sello, cuál es; en otra, el sello permanente que lleva */
  seal?: SealId;
  /** Mejora de valor */
  bonus?: number;
  /** Comodín de sello */
  wild?: boolean;
}

/** Mejoras entre jefes */
export type Boon =
  | { kind: 'heal' }
  | { kind: 'card'; rank: Rank | 'WILD' }
  | { kind: 'seal'; seal: SealId; target: number }
  | { kind: 'upgrade'; target: number }
  | { kind: 'purge'; targets: number[] }
  | { kind: 'maxLife' }
  | { kind: 'pact' };

export interface CastleRun {
  /** Jefe al que te enfrentas (índice en BOSSES) */
  stage: number;
  lives: number;
  maxLives: number;
  deck: CardTemplate[];
  /** Pacto: el próximo jefe empieza con una vida menos */
  pact?: boolean;
  /** Mejoras para elegir tras la última victoria */
  offer?: Boon[];
}

export interface CastleState {
  run: CastleRun | null;
  /** Mejor subida (jefes vencidos) */
  best: number;
  /** Veces que lo has conquistado */
  conquered: number;
}

export const CASTLE_LENGTH = BOSSES.length;
const KEY = 'magic_poker_castle';
const EMPTY: CastleState = { run: null, best: 0, conquered: 0 };

// --- PERSISTENCIA ---
const listeners = new Set<() => void>();
let cached: CastleState | null = null;

export const getCastle = (): CastleState => {
  if (typeof window === 'undefined') return EMPTY;
  if (!cached) {
    try {
      const raw = localStorage.getItem(KEY);
      cached = raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<CastleState>) } : EMPTY;
      // Una subida rota o de otra versión se descarta
      if (cached.run && !isRun(cached.run)) cached = { ...cached, run: null };
    } catch {
      cached = EMPTY;
    }
  }
  return cached;
};
export const getServerCastle = (): CastleState => EMPTY;
export const subscribeCastle = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

const save = (state: CastleState) => {
  cached = state;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* sin almacenamiento */ }
  listeners.forEach(l => l());
};

const isRun = (r: CastleRun) =>
  typeof r.stage === 'number' && r.stage >= 0 && r.stage < CASTLE_LENGTH && typeof r.lives === 'number' && Array.isArray(r.deck)
  && r.deck.every(c => c.rank in RANKS && (c.seal === undefined || ALL_SEALS.includes(c.seal)));

// --- SUBIDA ---

/** Tu mazo del editor como plantillas */
const startingDeck = (): CardTemplate[] => {
  const config = sanitizeDeckConfig(getDeckConfig() ?? defaultDeckConfig());
  const removed = new Set(config.removed);
  return [
    ...DECK_RANKS.filter(r => !removed.has(r)).map(rank => ({ rank })),
    ...(Object.entries(config.seals) as [SealId, number][]).flatMap(([seal, n]) => Array.from({ length: n }, () => ({ rank: 'SEAL' as Rank, seal }))),
  ];
};

/** Empieza una subida nueva (o devuelve la que está a medias) */
export const ensureRun = (): CastleRun => {
  const state = getCastle();
  if (state.run) return state.run;
  const run: CastleRun = { stage: 0, lives: STARTING_LIVES, maxLives: STARTING_LIVES, deck: startingDeck() };
  save({ ...state, run });
  return run;
};

export const abandonRun = () => save({ ...getCastle(), run: null });

/** Jefe evolucionado: nivel de revancha según lo alto que estés */
export const castleBossLevel = (stage: number) => (stage < 4 ? 1 : stage < 8 ? 2 : 3);
/** Vidas del jefe: menos que en sus partidas (aquí las tuyas se arrastran), crecen al subir */
export const castleBossLives = (run: CastleRun) => Math.max(1, 3 + Math.floor(run.stage / 3) - (run.pact ? 1 : 0));

/** Mazo de la pelea a partir de las plantillas */
export const buildRunDeck = (run: CastleRun): Card[] => shuffle(run.deck.map(t =>
  t.wild ? createWildSealCard('player')
    : t.rank === 'SEAL' ? createSealCard('player', t.seal!)
      : createCard('player', t.rank, { seal: t.seal, bonus: t.bonus })));

// --- MEJORAS ---

const pick = <T,>(items: T[], rng: Rng): T => items[Math.floor(rng() * items.length)];
/** Cartas normales del mazo (las que se pueden mejorar, sellar o quitar) */
const normalCards = (run: CastleRun) => run.deck.map((c, i) => ({ c, i })).filter(({ c }) => c.rank !== 'SEAL');

/** Una mejora concreta de cada tipo (o null si ahora no tiene sentido) */
const makeBoon = (kind: Boon['kind'], run: CastleRun, rng: Rng): Boon | null => {
  switch (kind) {
    case 'heal': return run.lives < run.maxLives ? { kind } : null;
    case 'card': return { kind, rank: pick<Rank | 'WILD'>([...CASTLE_RANKS, 'WILD'], rng) };
    case 'seal': {
      const free = normalCards(run).filter(({ c }) => !c.seal);
      return free.length ? { kind, seal: pick(ALL_SEALS, rng), target: pick(free, rng).i } : null;
    }
    case 'upgrade': {
      const cards = normalCards(run).filter(({ c }) => RANKS[c.rank].attack);
      return cards.length ? { kind, target: pick(cards, rng).i } : null;
    }
    case 'purge': {
      const cards = normalCards(run);
      if (cards.length < 9) return null;
      // Las dos más flojas, para que salgan más a menudo las buenas
      const weakest = [...cards].sort((a, b) => RANKS[a.c.rank].value + (a.c.bonus ?? 0) - RANKS[b.c.rank].value - (b.c.bonus ?? 0)).slice(0, 2);
      return { kind, targets: weakest.map(w => w.i) };
    }
    case 'maxLife': return { kind };
    case 'pact': return run.lives >= 2 ? { kind } : null;
  }
};

/** Tres mejoras de la bolsa: curarte y una carta nueva casi siempre; el resto, al azar */
export const offerBoons = (run: CastleRun, rng: Rng = Math.random): Boon[] => {
  const out: Boon[] = [];
  const add = (kind: Boon['kind']) => {
    if (out.length >= 3 || out.some(b => b.kind === kind)) return;
    const boon = makeBoon(kind, run, rng);
    if (boon) out.push(boon);
  };
  if (rng() < 0.85) add('heal');
  if (rng() < 0.85) add('card');
  for (const kind of shuffle<Boon['kind']>(['seal', 'upgrade', 'purge', 'maxLife', 'pact', 'heal', 'card'], rng)) add(kind);
  return out;
};

export const applyBoon = (run: CastleRun, boon: Boon): CastleRun => {
  const next: CastleRun = { ...run, deck: [...run.deck], offer: undefined, pact: false };
  switch (boon.kind) {
    case 'heal': next.lives = next.maxLives; break;
    case 'card': next.deck.push(boon.rank === 'WILD' ? { rank: 'SEAL', wild: true } : { rank: boon.rank }); break;
    case 'seal': next.deck[boon.target] = { ...next.deck[boon.target], seal: boon.seal }; break;
    case 'upgrade': next.deck[boon.target] = { ...next.deck[boon.target], bonus: (next.deck[boon.target].bonus ?? 0) + 2 }; break;
    case 'purge': next.deck = next.deck.filter((_, i) => !boon.targets.includes(i)); break;
    case 'maxLife': next.maxLives += 1; next.lives += 1; break;
    case 'pact': next.pact = true; next.lives -= 1; break;
  }
  return next;
};

/** Eliges una mejora: se aplica y se guarda la subida */
export const chooseBoon = (index: number): CastleRun | null => {
  const state = getCastle();
  const boon = state.run?.offer?.[index];
  if (!state.run || !boon) return null;
  const run = applyBoon(state.run, boon);
  save({ ...state, run });
  return run;
};

// --- RESULTADO DE CADA PELEA ---

export type CastleOutcome = { kind: 'next'; run: CastleRun } | { kind: 'conquered' } | { kind: 'fallen'; stage: number };

/** Vences al jefe de turno: subes un piso (o conquistas el Castillo) */
export const recordCastleWin = (livesLeft: number, rng: Rng = Math.random): CastleOutcome => {
  const state = getCastle();
  if (!state.run) return { kind: 'fallen', stage: 0 };
  const stage = state.run.stage + 1;
  if (stage >= CASTLE_LENGTH) {
    save({ run: null, best: CASTLE_LENGTH, conquered: state.conquered + 1 });
    return { kind: 'conquered' };
  }
  const run: CastleRun = { ...state.run, stage, lives: livesLeft, pact: false };
  run.offer = offerBoons(run, rng);
  save({ ...state, run, best: Math.max(state.best, stage) });
  return { kind: 'next', run };
};

/** Caes (o empatas): la subida se acaba */
export const recordCastleLoss = (): CastleOutcome => {
  const state = getCastle();
  const stage = state.run?.stage ?? 0;
  save({ ...state, run: null, best: Math.max(state.best, stage) });
  return { kind: 'fallen', stage };
};
