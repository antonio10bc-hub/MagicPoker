// --- EL BOSQUE (PvE, tras conquistar el Castillo) ---
// Un gacha de duelos: al buscar duelo, alguien sale de entre los árboles. Primero se
// sortea el nivel (normal, difícil, pesadilla o único) y luego quién de ese nivel. Cada
// personaje es de un nivel y juega a su manera por sus sellos y sus cartas: defensivos,
// agresivos o puñeteros (troll). Los únicos son tres, de la realeza: el Príncipe, la
// Reina y el Rey, que llevan su figura repetida tres veces en vez de las tres figuras.
// No hay premios que cambien el juego: se lleva un bestiario (a quién has encontrado y
// cuántas veces lo has vencido) y tu racha.
import { Card, Difficulty, GameResult, Rank, SealId } from '@/types';
import { createCard, createDeck, createSealCard, shuffle } from '@/lib/game-utils';
import { getCastle } from '@/lib/castle';
import { DeckConfig, MAX_COPIES, MAX_SEALS } from '@/lib/deck';

export type Tier = 'normal' | 'hard' | 'nightmare' | 'unique';
export const TIERS: Tier[] = ['normal', 'hard', 'nightmare', 'unique'];
/** Probabilidad (de 100) de cada nivel */
export const TIER_WEIGHTS: Record<Tier, number> = { normal: 57, hard: 28, nightmare: 10, unique: 5 };

export type Style = 'defensive' | 'aggressive' | 'troll';

export interface Archetype {
  id: string;
  tier: Tier;
  style: Style;
  /** Sellos con los que juega */
  seals: SealId[];
  /** Cartas del Castillo que lleva (1 copia en difícil, 2 en pesadilla) */
  cards: Rank[];
  /** Los únicos: su figura, tres veces, en lugar de Príncipe, Reina y Rey */
  royal?: 'J' | 'Q' | 'K';
  /** Tema de música (el del jefe que más se le parece) */
  music: string;
}

export const ARCHETYPES: Archetype[] = [
  // --- Normal ---
  { id: 'woodcutter', tier: 'normal', style: 'defensive', seals: ['shield', 'anchor'], cards: ['TOWER'], music: 'wall' },
  { id: 'shepherd', tier: 'normal', style: 'defensive', seals: ['life', 'shield'], cards: ['PRIESTESS'], music: 'drifter' },
  { id: 'huntress', tier: 'normal', style: 'aggressive', seals: ['double', 'reveal'], cards: ['KNIGHT'], music: 'duelist' },
  { id: 'goblin', tier: 'normal', style: 'troll', seals: ['shift', 'echo', 'swap'], cards: ['JESTER'], music: 'trickster' },
  // --- Difícil ---
  { id: 'hermit', tier: 'hard', style: 'defensive', seals: ['life', 'shield'], cards: ['PRIESTESS'], music: 'matriarch' },
  { id: 'bandit', tier: 'hard', style: 'aggressive', seals: ['swap', 'double'], cards: ['BOMB'], music: 'thief' },
  { id: 'executioner', tier: 'hard', style: 'aggressive', seals: ['double', 'poison'], cards: ['KNIGHT'], music: 'duelist' },
  { id: 'witch', tier: 'hard', style: 'troll', seals: ['poison', 'mirror'], cards: ['SPY'], music: 'poisoner' },
  // --- Pesadilla ---
  { id: 'gravedigger', tier: 'nightmare', style: 'defensive', seals: ['anchor', 'shield', 'life'], cards: ['TOWER'], music: 'sailor' },
  { id: 'wolf', tier: 'nightmare', style: 'aggressive', seals: ['double', 'swap', 'reveal'], cards: ['KNIGHT'], music: 'thief' },
  { id: 'scarecrow', tier: 'nightmare', style: 'troll', seals: ['shift', 'mirror', 'echo'], cards: ['JESTER'], music: 'trickster' },
  { id: 'mourner', tier: 'nightmare', style: 'troll', seals: ['poison', 'echo', 'life'], cards: ['SPY'], music: 'seer' },
  // --- Únicos: la realeza del bosque ---
  { id: 'prince', tier: 'unique', style: 'aggressive', seals: ['double', 'reveal'], cards: [], royal: 'J', music: 'sovereign' },
  { id: 'queen', tier: 'unique', style: 'troll', seals: ['mirror', 'shift'], cards: [], royal: 'Q', music: 'sovereign' },
  { id: 'king', tier: 'unique', style: 'defensive', seals: ['shield', 'anchor'], cards: [], royal: 'K', music: 'sovereign' },
];

export const archetype = (id: string) => ARCHETYPES.find(a => a.id === id);
export const archetypesOf = (tier: Tier) => ARCHETYPES.filter(a => a.tier === tier);

/** El Bosque se abre al conquistar el Castillo por primera vez */
export const isForestUnlocked = (castle = getCastle()) => castle.conquered > 0;

export interface Encounter { id: string; tier: Tier }

/** Quién sale del bosque: primero el nivel, luego alguien de ese nivel */
export const rollEncounter = (rng: () => number = Math.random): Encounter => {
  let roll = rng() * 100;
  const tier = TIERS.find(t => (roll -= TIER_WEIGHTS[t]) < 0) ?? 'normal';
  const pool = archetypesOf(tier);
  return { id: pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))].id, tier };
};

/** Vidas del rival por nivel */
export const FOREST_LIVES: Record<Tier, number> = { normal: 4, hard: 5, nightmare: 6, unique: 7 };
/** Cómo piensa: en normal, la IA normal; desde difícil, la difícil */
export const forestAi = (tier: Tier): Difficulty => (tier === 'normal' ? 'normal' : 'hard');

/** Copias de sus sellos y de sus cartas del Castillo según el nivel */
const SEAL_COPIES: Record<Tier, number> = { normal: 1, hard: 2, nightmare: 3, unique: 2 };
const CARD_COPIES: Record<Tier, number> = { normal: 0, hard: 1, nightmare: 2, unique: 0 };

/**
 * Mazo del rival: el estándar, sus sellos y sus cartas del Castillo. Los únicos cambian
 * las tres figuras (Príncipe, Reina y Rey) por tres copias de la suya.
 */
export const buildForestDeck = (a: Archetype, tier: Tier = a.tier): Card[] => {
  const royal = a.royal;
  const base = royal
    ? [...createDeck('opponent').filter(c => !['J', 'Q', 'K'].includes(c.rank)), ...Array.from({ length: 3 }, () => createCard('opponent', royal))]
    : createDeck('opponent');
  return shuffle([
    ...base,
    ...a.seals.flatMap(s => Array.from({ length: SEAL_COPIES[tier] }, () => createSealCard('opponent', s))),
    ...a.cards.flatMap(r => Array.from({ length: CARD_COPIES[tier] }, () => createCard('opponent', r))),
  ]);
};

/**
 * Su mazo, en lo que tú puedes llevar (para copiarlo al editor): sus sellos, a 2 copias
 * cada uno hasta llenar los 5. Sus cartas del Castillo no se copian: esas solo
 * existen dentro del Castillo.
 */
export const forestDeckConfig = (a: Archetype): DeckConfig => {
  const seals: DeckConfig['seals'] = {};
  let left = MAX_SEALS;
  // Primero una de cada, luego la segunda
  for (let round = 0; round < MAX_COPIES; round++) {
    a.seals.forEach(s => { if (left > 0) { seals[s] = (seals[s] ?? 0) + 1; left--; } });
  }
  return { seals, removed: [] };
};

// --- BESTIARIO Y RACHA (Local Storage, con suscripción para la interfaz) ---
const KEY = 'magic_poker_forest';

export interface TierRecord { wins: number; losses: number }
export interface ForestState {
  /** Encuentros por arquetipo y dificultad */
  seen: Record<string, Partial<Record<Tier, TierRecord>>>;
  duels: number;
  streak: number;
  bestStreak: number;
}

const EMPTY: ForestState = { seen: {}, duels: 0, streak: 0, bestStreak: 0 };
const listeners = new Set<() => void>();
let cached: ForestState | null = null;

export const getForest = (): ForestState => {
  if (typeof window === 'undefined') return EMPTY;
  if (!cached) {
    try {
      const raw = localStorage.getItem(KEY);
      cached = raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<ForestState>) } : EMPTY;
    } catch {
      cached = EMPTY;
    }
  }
  return cached;
};
export const getServerForest = (): ForestState => EMPTY;
export const subscribeForest = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

const save = (f: ForestState) => {
  cached = f;
  try { localStorage.setItem(KEY, JSON.stringify(f)); } catch { /* sin almacenamiento */ }
  listeners.forEach(l => l());
};

/** Anota el duelo. Devuelve el estado nuevo (para los logros) */
export const recordForestDuel = (e: Encounter, result: GameResult): ForestState => {
  const f = getForest();
  const prev = f.seen[e.id]?.[e.tier] ?? { wins: 0, losses: 0 };
  const win = result === 'win';
  const streak = win ? f.streak + 1 : result === 'draw' ? f.streak : 0;
  const next: ForestState = {
    seen: { ...f.seen, [e.id]: { ...f.seen[e.id], [e.tier]: { wins: prev.wins + (win ? 1 : 0), losses: prev.losses + (result === 'loss' ? 1 : 0) } } },
    duels: f.duels + 1,
    streak,
    bestStreak: Math.max(f.bestStreak, streak),
  };
  save(next);
  return next;
};

/** Victorias y derrotas contra alguien, sumando todos sus encuentros */
export const recordOf = (f: ForestState, id: string): TierRecord | null => {
  const rec = f.seen[id];
  if (!rec) return null;
  return Object.values(rec).reduce<TierRecord>((t, r) => ({ wins: t.wins + (r?.wins ?? 0), losses: t.losses + (r?.losses ?? 0) }), { wins: 0, losses: 0 });
};

/** Ya has visto a todos los arquetipos */
export const bestiaryComplete = (f: ForestState = getForest()) => ARCHETYPES.every(a => f.seen[a.id]);
