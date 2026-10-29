// --- BOSSES Y PROGRESIÓN ---
// Cada partida es contra el boss actual. Al vencerlo se desbloquea su sello (una
// copia entra en tu mazo) y aparece el siguiente. El primero no tiene sello: vencerlo
// desbloquea la colección de sellos; con el primer sello llega el editor de mazo. Tras
// el último normal aparece un jefe secreto que usa todos los sellos.
// Revancha: un jefe ya vencido vuelve más fuerte, y cada revancha ganada sube su nivel
// (ver bossSeals y bossLives). Con 5 victorias contra un jefe se gana su dorso de carta.
import { Card, PlayerState, SealId } from '@/types';
import { createDeck, createDualState, createSealCard, shuffle } from '@/lib/game-utils';

export interface Boss {
  id: string;
  /** Sello que usa en combate y que desbloqueas al vencerlo */
  seal: SealId | null;
  lives: number;
  /** Jefe secreto: no sale en la lista hasta que lo alcanzas */
  secret?: boolean;
}

export const BOSSES: Boss[] = [
  // Vidas ajustadas con la simulación de balanceo (scripts/balance): la primera vez todos
  // piensan con la IA normal y la dificultad sube poco a poco, sin escalones
  { id: 'drifter', seal: null, lives: 3 },
  { id: 'wall', seal: 'shield', lives: 3 },
  { id: 'duelist', seal: 'double', lives: 4 },
  { id: 'trickster', seal: 'shift', lives: 5 },
  { id: 'thief', seal: 'swap', lives: 5 },
  { id: 'matriarch', seal: 'life', lives: 5 },
  { id: 'mirrorist', seal: 'mirror', lives: 5 },
  { id: 'poisoner', seal: 'poison', lives: 5 },
  { id: 'bard', seal: 'echo', lives: 6 },
  { id: 'sailor', seal: 'anchor', lives: 6 },
  { id: 'seer', seal: 'reveal', lives: 6 },
  { id: 'sovereign', seal: null, lives: 7, secret: true },
];

/** Todos los sellos, en el orden en que se desbloquean */
export const ALL_SEALS: SealId[] = BOSSES.flatMap(b => (b.seal ? [b.seal] : []));

/** Copias de su sello que lleva cada boss en el mazo */
const BOSS_SEAL_COPIES = 2;

// --- REVANCHAS (niveles) ---
// Nivel 1: +1 vida y un segundo sello · 2: una copia más de cada sello ·
// 3: +2 vidas · 4: un tercer sello. Del 4 no pasa.
export const MAX_REMATCH_LEVEL = 4;
/** Victorias contra un jefe para ganar su dorso */
export const WINS_FOR_BACK = 5;

/** Sellos de los jefes siguientes (dando la vuelta a la lista), para las revanchas */
const nextSeals = (boss: Boss, n: number): SealId[] => {
  const from = boss.seal ? ALL_SEALS.indexOf(boss.seal) + 1 : 0;
  return [...ALL_SEALS.slice(from), ...ALL_SEALS.slice(0, from)].filter(s => s !== boss.seal).slice(0, n);
};

/** Sellos del mazo de un jefe: el suyo (el secreto, todos); en revancha, más según el nivel */
export const bossSeals = (boss: Boss, level = 0): SealId[] => {
  if (boss.secret) return ALL_SEALS.flatMap(s => Array<SealId>(level >= 2 ? 2 : 1).fill(s));
  const copies = BOSS_SEAL_COPIES + (level >= 2 ? 1 : 0);
  const kinds = [...(boss.seal ? [boss.seal] : []), ...(level >= 1 ? nextSeals(boss, level >= 4 ? 2 : 1) : [])];
  return kinds.flatMap(s => Array<SealId>(copies).fill(s));
};

/** Vidas de un jefe (en revancha: +1, y +2 desde el nivel 3) */
export const bossLives = (boss: Boss, level = 0) => boss.lives + (level >= 3 ? 2 : level >= 1 ? 1 : 0);

// --- PROGRESO (Local Storage, con suscripción para la interfaz) ---
const KEY = 'magic_poker_progress';

export interface Progress {
  /** Bosses vencidos (en orden) */
  defeated: number;
  /** Antiguo: jefes vencidos también en revancha (ids) */
  rematches?: string[];
  /** Victorias contra cada jefe (la primera y las revanchas) */
  wins?: Record<string, number>;
}

const listeners = new Set<() => void>();
const EMPTY: Progress = { defeated: 0 };
let cached: Progress | null = null;

export const getProgress = (): Progress => {
  if (typeof window === 'undefined') return EMPTY;
  if (!cached) {
    try {
      const raw = localStorage.getItem(KEY);
      cached = raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Progress>) } : EMPTY;
    } catch {
      cached = EMPTY;
    }
  }
  return cached;
};
export const getServerProgress = (): Progress => EMPTY;
export const subscribeProgress = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

const save = (p: Progress) => {
  cached = p;
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* sin almacenamiento */ }
  listeners.forEach(l => l());
};

/** Índice del boss a derrotar (el último se repite cuando ya los has vencido todos) */
export const currentBossIndex = (p: Progress = getProgress()) => Math.min(p.defeated, BOSSES.length - 1);
export const isCollectionUnlocked = (p: Progress = getProgress()) => p.defeated >= 1;
export const unlockedSeals = (p: Progress = getProgress()): SealId[] =>
  BOSSES.slice(0, p.defeated).flatMap(b => (b.seal ? [b.seal] : []));

export type Unlock = { kind: 'collection' } | { kind: 'seal'; seal: SealId } | { kind: 'secret' } | { kind: 'editor' }
  | { kind: 'back'; boss: string } | { kind: 'castle' };

/** Victorias contra un jefe: la primera cuenta y cada revancha ganada suma */
export const bossWins = (index: number, p: Progress = getProgress()): number => {
  const id = BOSSES[index].id;
  if (index >= p.defeated) return 0;
  return Math.max(1, p.wins?.[id] ?? 0, p.rematches?.includes(id) ? 2 : 0);
};

/** Nivel de la próxima revancha contra un jefe vencido (1 a 4) */
export const rematchLevel = (index: number, p: Progress = getProgress()) => Math.min(MAX_REMATCH_LEVEL, bossWins(index, p));

/** Dorsos ganados (ids de jefe) */
export const unlockedBacks = (p: Progress = getProgress()): string[] =>
  BOSSES.filter((_, i) => bossWins(i, p) >= WINS_FOR_BACK).map(b => b.id);

/** El Castillo se abre al vencer al jefe secreto */
export const isCastleUnlocked = (p: Progress = getProgress()) => p.defeated >= BOSSES.length;

/** El jefe secreto (el último) solo se ve cuando ya has vencido a los demás */
export const isBossVisible = (index: number, p: Progress = getProgress()) => !BOSSES[index].secret || p.defeated >= index;
/** El editor de mazo se desbloquea con el primer sello (al vencer al segundo jefe, el Muro) */
export const isEditorUnlocked = (p: Progress = getProgress()) => p.defeated >= 2;

/** Registra la victoria contra un boss. Devuelve lo que se desbloquea (si es nuevo). */
export const recordBossDefeat = (index: number): Unlock[] => {
  const p = getProgress();
  if (index !== p.defeated || index >= BOSSES.length) return [];
  const boss = BOSSES[index];
  save({ ...p, defeated: p.defeated + 1, wins: { ...p.wins, [boss.id]: 1 } });
  // El primero abre el Grimorio
  if (index === 0) return [{ kind: 'collection' }];
  const out: Unlock[] = boss.seal ? [{ kind: 'seal', seal: boss.seal }] : [];
  // Con el primer sello llega el editor de mazo
  if (index === 1) out.push({ kind: 'editor' });
  // Tras el último normal aparece el jefe secreto; tras el secreto, el Castillo
  if (BOSSES[index + 1]?.secret) out.push({ kind: 'secret' });
  if (boss.secret) out.push({ kind: 'castle' });
  return out;
};

/** Registra una revancha ganada. Devuelve el dorso si es la victoria que lo desbloquea. */
export const recordRematchWin = (index: number): Unlock[] => {
  const p = getProgress();
  const boss = BOSSES[index];
  if (!boss || index >= p.defeated) return [];
  const wins = bossWins(index, p) + 1;
  save({ ...p, wins: { ...p.wins, [boss.id]: wins } });
  return wins === WINS_FOR_BACK ? [{ kind: 'back', boss: boss.id }] : [];
};

/** Vuelve al primer boss: se pierden los bosses vencidos y sus sellos */
export const resetProgress = () => save({ ...EMPTY });

// --- MAZOS ---

/** Tu mazo: el estándar más una carta de cada sello desbloqueado */
export const buildPlayerDeck = (seals: SealId[] = unlockedSeals()): Card[] =>
  shuffle([...createDeck('player'), ...seals.map(s => createSealCard('player', s))]);

/** Mazo del boss: el estándar más sus sellos (ver bossSeals) */
export const buildBossDeck = (boss: Boss, level = 0): Card[] =>
  shuffle([...createDeck('opponent'), ...bossSeals(boss, level).map(s => createSealCard('opponent', s))]);

/**
 * Estado del boss al empezar: su mano y sus dos mazos (el de póker y el de sellos, como
 * todos: ver createDualState). Empieza con 3 cartas y 1 sello y cada ronda roba sus 2
 * cartas y 1 sello.
 */
export const createBossState = (boss: Boss, level: number, lives: number, handSize: number): PlayerState =>
  createDualState(buildBossDeck(boss, level), handSize, false, lives);
