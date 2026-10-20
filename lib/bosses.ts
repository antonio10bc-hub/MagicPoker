// --- BOSSES Y PROGRESIÓN ---
// Cada partida es contra el boss actual. Al vencerlo se desbloquea su sello (una
// copia entra en tu mazo) y aparece el siguiente. El primero no tiene sello: vencerlo
// desbloquea la colección de sellos. El último queda para rejugar.
import { Card, SealId } from '@/types';
import { createDeck, createSealCard, shuffle } from '@/lib/game-utils';

export interface Boss {
  id: string;
  /** Sello que usa en combate y que desbloqueas al vencerlo */
  seal: SealId | null;
  lives: number;
}

export const BOSSES: Boss[] = [
  { id: 'drifter', seal: null, lives: 4 },
  { id: 'wall', seal: 'shield', lives: 4 },
  { id: 'duelist', seal: 'double', lives: 4 },
  { id: 'trickster', seal: 'shift', lives: 5 },
  { id: 'thief', seal: 'swap', lives: 5 },
  { id: 'matriarch', seal: 'life', lives: 5 },
];

/** Copias de su sello que lleva cada boss en el mazo */
const BOSS_SEAL_COPIES = 2;

// --- PROGRESO (Local Storage, con suscripción para la interfaz) ---
const KEY = 'magic_poker_progress';

export interface Progress {
  /** Bosses vencidos (en orden) */
  defeated: number;
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

export type Unlock = { kind: 'collection' } | { kind: 'seal'; seal: SealId };

/** Registra la victoria contra un boss. Devuelve lo que se desbloquea (si es nuevo). */
export const recordBossDefeat = (index: number): Unlock[] => {
  const p = getProgress();
  if (index !== p.defeated || index >= BOSSES.length) return [];
  save({ ...p, defeated: p.defeated + 1 });
  const seal = BOSSES[index].seal;
  return index === 0 ? [{ kind: 'collection' }] : seal ? [{ kind: 'seal', seal }] : [];
};

// --- MAZOS ---

/** Tu mazo: el estándar más una carta de cada sello desbloqueado */
export const buildPlayerDeck = (seals: SealId[] = unlockedSeals()): Card[] =>
  shuffle([...createDeck('player'), ...seals.map(s => createSealCard('player', s))]);

/** Mazo del boss: el estándar más varias copias de su sello */
export const buildBossDeck = (boss: Boss): Card[] =>
  shuffle([...createDeck('opponent'), ...(boss.seal ? Array.from({ length: BOSS_SEAL_COPIES }, () => createSealCard('opponent', boss.seal!)) : [])]);
