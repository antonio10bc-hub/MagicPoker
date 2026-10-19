// --- GESTIÓN DE ESTADÍSTICAS (Local Storage) ---
import { Difficulty, GameResult, Rank } from '@/types';
import { STORAGE_KEYS } from '@/lib/constants';
import { StampId } from '@/lib/stamps';

export interface HistoryEntry { r: GameResult; d: Difficulty }

export interface GameStats {
  wins: Record<Difficulty, number>;
  losses: number;
  draws: number;
  totalGames: number;
  cardsPlayed: number;
  cardsDestroyed: number;
  /** Vidas que le has quitado al rival / que has perdido */
  livesTaken: number;
  livesLost: number;
  roundsPlayed: number;
  currentStreak: number;
  bestStreak: number;
  /** Victoria en menos rondas (null si aún no has ganado) */
  fastestWin: number | null;
  /** Victorias sin perder ninguna vida */
  perfectWins: number;
  /** Cuántas veces has jugado cada carta */
  rankPlayed: Partial<Record<Rank, number>>;
  /** Últimas partidas, la más reciente al final */
  history: HistoryEntry[];
  /** Sellos conseguidos (id → fecha en ms) */
  stamps: Partial<Record<StampId, number>>;
  /** Heredado: logro "La Republicana" (ahora es un sello) */
  achievementRepublicana: boolean;
}

const HISTORY_SIZE = 12;

const INITIAL_STATS: GameStats = {
  wins: { easy: 0, normal: 0, hard: 0 },
  losses: 0,
  draws: 0,
  totalGames: 0,
  cardsPlayed: 0,
  cardsDestroyed: 0,
  livesTaken: 0,
  livesLost: 0,
  roundsPlayed: 0,
  currentStreak: 0,
  bestStreak: 0,
  fastestWin: null,
  perfectWins: 0,
  rankPlayed: {},
  history: [],
  stamps: {},
  achievementRepublicana: false,
};

type CounterStat = 'totalGames' | 'cardsPlayed' | 'cardsDestroyed';

// Obtener estadísticas (si no existen, devuelve las iniciales). Los datos antiguos se
// completan con los campos nuevos y el logro heredado pasa a ser un sello.
export const getStats = (): GameStats => {
  if (typeof window === 'undefined') return INITIAL_STATS;
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.stats);
    if (!stored) return INITIAL_STATS;
    const parsed = JSON.parse(stored) as Partial<GameStats>;
    const stats: GameStats = { ...INITIAL_STATS, ...parsed, wins: { ...INITIAL_STATS.wins, ...parsed.wins } };
    if (stats.achievementRepublicana && !stats.stamps.republicana) stats.stamps = { ...stats.stamps, republicana: 0 };
    return stats;
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

export const recordCardPlayed = (rank: Rank) =>
  updateStats(s => ({ ...s, cardsPlayed: s.cardsPlayed + 1, rankPlayed: { ...s.rankPlayed, [rank]: (s.rankPlayed[rank] ?? 0) + 1 } }));

/** Al terminar cada pelea */
export const recordRound = (destroyed: number, livesTaken: number, livesLost: number) =>
  updateStats(s => ({
    ...s,
    roundsPlayed: s.roundsPlayed + 1,
    cardsDestroyed: s.cardsDestroyed + destroyed,
    livesTaken: s.livesTaken + livesTaken,
    livesLost: s.livesLost + livesLost,
  }));

/** Al terminar la partida. Devuelve las estadísticas ya actualizadas. */
export const recordGameEnd = (result: GameResult, difficulty: Difficulty, rounds: number, perfect: boolean): GameStats => {
  updateStats(s => {
    const win = result === 'win';
    const streak = win ? s.currentStreak + 1 : 0;
    return {
      ...s,
      wins: win ? { ...s.wins, [difficulty]: s.wins[difficulty] + 1 } : s.wins,
      losses: s.losses + (result === 'loss' ? 1 : 0),
      draws: s.draws + (result === 'draw' ? 1 : 0),
      currentStreak: streak,
      bestStreak: Math.max(s.bestStreak, streak),
      fastestWin: win ? Math.min(s.fastestWin ?? Infinity, rounds) : s.fastestWin,
      perfectWins: s.perfectWins + (win && perfect ? 1 : 0),
      history: [...s.history, { r: result, d: difficulty }].slice(-HISTORY_SIZE),
    };
  });
  return getStats();
};

/** Marca un sello como conseguido. Devuelve true solo si es nuevo. */
export const unlockStamp = (id: StampId): boolean => {
  if (getStats().stamps[id] !== undefined) return false;
  updateStats(s => ({ ...s, stamps: { ...s.stamps, [id]: Date.now() }, achievementRepublicana: s.achievementRepublicana || id === 'republicana' }));
  return true;
};

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
