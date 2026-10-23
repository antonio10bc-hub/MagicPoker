// --- EL BOSQUE (PvE, tras conquistar el Castillo) ---
// Un gacha de duelos: al buscar duelo, alguien sale de entre los árboles. Quién es (un
// arquetipo) y cuánto aprieta (normal, difícil o pesadilla) se sortea. Cada arquetipo
// juega a su manera por sus sellos y sus cartas: defensivos, agresivos o puñeteros
// (troll). No hay premios que cambien el juego: se lleva un bestiario (a quién has
// encontrado y a cuántos has vencido en cada dificultad) y tu racha.
import { Card, Difficulty, GameResult, Rank, SealId } from '@/types';
import { createCard, createDeck, createSealCard, shuffle } from '@/lib/game-utils';
import { getCastle } from '@/lib/castle';

export type Tier = 'normal' | 'hard' | 'nightmare';
export const TIERS: Tier[] = ['normal', 'hard', 'nightmare'];
/** Probabilidad (de 100) de cada dificultad */
export const TIER_WEIGHTS: Record<Tier, number> = { normal: 60, hard: 30, nightmare: 10 };

export type Style = 'defensive' | 'aggressive' | 'troll';

export interface Archetype {
  id: string;
  style: Style;
  /** Sellos con los que juega */
  seals: SealId[];
  /** Cartas del Castillo que lleva desde "difícil" */
  cards: Rank[];
  /** Tema de música (el del jefe que más se le parece) */
  music: string;
}

export const ARCHETYPES: Archetype[] = [
  // Defensivos: aguantan y te desgastan
  { id: 'woodcutter', style: 'defensive', seals: ['shield', 'anchor'], cards: ['TOWER'], music: 'wall' },
  { id: 'hermit', style: 'defensive', seals: ['life', 'shield'], cards: ['PRIESTESS'], music: 'matriarch' },
  // Agresivos: golpean dos veces y van a por tus huecos
  { id: 'huntress', style: 'aggressive', seals: ['double', 'reveal'], cards: ['KNIGHT'], music: 'duelist' },
  { id: 'bandit', style: 'aggressive', seals: ['swap', 'double'], cards: ['BOMB'], music: 'thief' },
  // Troll: te cambian las cartas de sitio, te envenenan, te devuelven los golpes
  { id: 'witch', style: 'troll', seals: ['poison', 'mirror'], cards: ['SPY'], music: 'poisoner' },
  { id: 'goblin', style: 'troll', seals: ['shift', 'echo', 'swap'], cards: ['JESTER'], music: 'trickster' },
];

export const archetype = (id: string) => ARCHETYPES.find(a => a.id === id);

/** El Bosque se abre al conquistar el Castillo por primera vez */
export const isForestUnlocked = (castle = getCastle()) => castle.conquered > 0;

export interface Encounter { id: string; tier: Tier }

/** Quién sale del bosque (y en qué dificultad) */
export const rollEncounter = (rng: () => number = Math.random): Encounter => {
  const id = ARCHETYPES[Math.min(ARCHETYPES.length - 1, Math.floor(rng() * ARCHETYPES.length))].id;
  let roll = rng() * 100;
  const tier = TIERS.find(t => (roll -= TIER_WEIGHTS[t]) < 0) ?? 'normal';
  return { id, tier };
};

/** Vidas del rival por dificultad */
export const FOREST_LIVES: Record<Tier, number> = { normal: 4, hard: 5, nightmare: 6 };
/** Cómo piensa: en normal, el rival normal; en difícil y pesadilla, el difícil */
export const forestAi = (tier: Tier): Difficulty => (tier === 'normal' ? 'normal' : 'hard');

/** Mazo del rival: el estándar, sus sellos (1, 2 o 3 copias) y sus cartas del Castillo (0, 1 o 2) */
export const buildForestDeck = (a: Archetype, tier: Tier): Card[] => {
  const copies = TIERS.indexOf(tier) + 1;
  const extra = TIERS.indexOf(tier);
  return shuffle([
    ...createDeck('opponent'),
    ...a.seals.flatMap(s => Array.from({ length: copies }, () => createSealCard('opponent', s))),
    ...a.cards.flatMap(r => Array.from({ length: extra }, () => createCard('opponent', r))),
  ]);
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

/** Ya has visto a todos los arquetipos */
export const bestiaryComplete = (f: ForestState = getForest()) => ARCHETYPES.every(a => f.seen[a.id]);
