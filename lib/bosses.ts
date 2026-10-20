// --- BOSSES Y PROGRESIÓN ---
// Cada partida es contra el boss actual. Al vencerlo se desbloquea su sello (una
// copia entra en tu mazo) y aparece el siguiente. El primero no tiene sello: vencerlo
// desbloquea la colección de sellos; con el primer sello llega el editor de mazo. Tras
// el último normal aparece un jefe secreto que usa todos los sellos.
// Revancha: un boss ya vencido vuelve con una vida más y un segundo sello.
import { Card, SealId } from '@/types';
import { createDeck, createSealCard, shuffle } from '@/lib/game-utils';

export interface Boss {
  id: string;
  /** Sello que usa en combate y que desbloqueas al vencerlo */
  seal: SealId | null;
  lives: number;
  /** Jefe secreto: no sale en la lista hasta que lo alcanzas */
  secret?: boolean;
}

export const BOSSES: Boss[] = [
  { id: 'drifter', seal: null, lives: 4 },
  { id: 'wall', seal: 'shield', lives: 4 },
  { id: 'duelist', seal: 'double', lives: 4 },
  { id: 'trickster', seal: 'shift', lives: 5 },
  { id: 'thief', seal: 'swap', lives: 5 },
  { id: 'matriarch', seal: 'life', lives: 5 },
  { id: 'mirrorist', seal: 'mirror', lives: 5 },
  { id: 'poisoner', seal: 'poison', lives: 5 },
  { id: 'bard', seal: 'echo', lives: 5 },
  { id: 'sailor', seal: 'anchor', lives: 5 },
  { id: 'seer', seal: 'reveal', lives: 6 },
  { id: 'sovereign', seal: null, lives: 7, secret: true },
];

/** Todos los sellos, en el orden en que se desbloquean */
export const ALL_SEALS: SealId[] = BOSSES.flatMap(b => (b.seal ? [b.seal] : []));

/** Copias de su sello que lleva cada boss en el mazo */
const BOSS_SEAL_COPIES = 2;

/** Sellos del mazo de un boss: el suyo (el secreto, todos); en revancha, uno más */
export const bossSeals = (boss: Boss, rematch = false): SealId[] => {
  if (boss.secret) return rematch ? [...ALL_SEALS, ...ALL_SEALS] : ALL_SEALS;
  const own = boss.seal ? Array<SealId>(BOSS_SEAL_COPIES).fill(boss.seal) : [];
  if (!rematch) return own;
  // Revancha: el sello del boss siguiente (el Forastero, defensa)
  const i = BOSSES.indexOf(boss);
  const partner = BOSSES.slice(i + 1).find(b => b.seal)?.seal ?? 'shield';
  return [...own, ...Array<SealId>(BOSS_SEAL_COPIES).fill(partner)];
};

/** Vidas de un boss (en revancha, una más) */
export const bossLives = (boss: Boss, rematch = false) => boss.lives + (rematch ? 1 : 0);

// --- PROGRESO (Local Storage, con suscripción para la interfaz) ---
const KEY = 'magic_poker_progress';

export interface Progress {
  /** Bosses vencidos (en orden) */
  defeated: number;
  /** Bosses vencidos también en revancha (ids) */
  rematches?: string[];
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

export type Unlock = { kind: 'collection' } | { kind: 'seal'; seal: SealId } | { kind: 'secret' } | { kind: 'editor' };

/** El jefe secreto (el último) solo se ve cuando ya has vencido a los demás */
export const isBossVisible = (index: number, p: Progress = getProgress()) => !BOSSES[index].secret || p.defeated >= index;
/** El editor de mazo se desbloquea con el primer sello (al vencer al segundo boss) */
export const isEditorUnlocked = (p: Progress = getProgress()) => p.defeated >= 2;

/** Registra la victoria contra un boss. Devuelve lo que se desbloquea (si es nuevo). */
export const recordBossDefeat = (index: number): Unlock[] => {
  const p = getProgress();
  if (index !== p.defeated || index >= BOSSES.length) return [];
  save({ ...p, defeated: p.defeated + 1 });
  const boss = BOSSES[index];
  if (index === 0) return [{ kind: 'collection' }];
  const out: Unlock[] = boss.seal ? [{ kind: 'seal', seal: boss.seal }] : [];
  // Con el primer sello llega el editor de mazo
  if (index === 1) out.push({ kind: 'editor' });
  // Tras el último normal aparece el jefe secreto
  if (BOSSES[index + 1]?.secret) out.push({ kind: 'secret' });
  return out;
};

/** Registra una victoria en revancha. Devuelve true si es la primera contra ese boss. */
export const recordRematchWin = (index: number): boolean => {
  const p = getProgress();
  const id = BOSSES[index]?.id;
  if (!id || p.rematches?.includes(id)) return false;
  save({ ...p, rematches: [...(p.rematches ?? []), id] });
  return true;
};

/** Vuelve al primer boss: se pierden los bosses vencidos y sus sellos */
export const resetProgress = () => save({ ...EMPTY });

// --- MAZOS ---

/** Tu mazo: el estándar más una carta de cada sello desbloqueado */
export const buildPlayerDeck = (seals: SealId[] = unlockedSeals()): Card[] =>
  shuffle([...createDeck('player'), ...seals.map(s => createSealCard('player', s))]);

/** Mazo del boss: el estándar más sus sellos (ver bossSeals) */
export const buildBossDeck = (boss: Boss, rematch = false): Card[] =>
  shuffle([...createDeck('opponent'), ...bossSeals(boss, rematch).map(s => createSealCard('opponent', s))]);
