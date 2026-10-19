// --- GESTIÓN DE ESTADÍSTICAS (Local Storage) ---
import { Difficulty } from '@/types';
import { STORAGE_KEYS } from '@/lib/constants';

export interface GameStats {
  wins: Record<Difficulty, number>;
  totalGames: number;
  cardsPlayed: number;
  cardsDestroyed: number;
  // Logros
  achievementRepublicana: boolean; // AS limpió J, Q y K a la vez
}

const INITIAL_STATS: GameStats = {
  wins: { easy: 0, normal: 0, hard: 0 },
  totalGames: 0,
  cardsPlayed: 0,
  cardsDestroyed: 0,
  achievementRepublicana: false,
};

type CounterStat = 'totalGames' | 'cardsPlayed' | 'cardsDestroyed';

// Obtener estadísticas (si no existen, devuelve las iniciales)
export const getStats = (): GameStats => {
  if (typeof window === 'undefined') return INITIAL_STATS;
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.stats);
    if (!stored) return INITIAL_STATS;
    const parsed = JSON.parse(stored) as Partial<GameStats>;
    return { ...INITIAL_STATS, ...parsed, wins: { ...INITIAL_STATS.wins, ...parsed.wins } };
  } catch (e) {
    console.error('Error reading stats', e);
    return INITIAL_STATS;
  }
};

// Única operación de escritura: lee, transforma y guarda en un solo paso
const updateStats = (update: (current: GameStats) => GameStats) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(update(getStats())));
  } catch (e) {
    console.error('Error saving stats', e);
  }
};

export const incrementStat = (key: CounterStat, amount = 1) =>
  updateStats(s => ({ ...s, [key]: s[key] + amount }));

export const recordWin = (difficulty: Difficulty) =>
  updateStats(s => ({ ...s, wins: { ...s.wins, [difficulty]: s.wins[difficulty] + 1 } }));

export const unlockRepublicana = () =>
  updateStats(s => ({ ...s, achievementRepublicana: true }));

/** Devuelve true solo la primera vez que se llama (para mostrar el tutorial). */
export const consumeFirstPlay = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem(STORAGE_KEYS.hasPlayedBefore)) return false;
    localStorage.setItem(STORAGE_KEYS.hasPlayedBefore, 'true');
    return true;
  } catch {
    return false;
  }
};
