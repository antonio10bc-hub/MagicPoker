// --- PARTIDA GUARDADA (Local Storage) ---
// Se guarda en cada momento "estable" (tu turno de colocar) para poder retomarla si
// se cierra la app. Se borra al terminar la partida o al salir al menú.
import { Difficulty, PlayerState } from '@/types';

const KEY = 'magic_poker_save';
const VERSION = 1;

export interface SavedGame {
  v: number;
  difficulty: Difficulty;
  roundNumber: number;
  player: PlayerState;
  opponent: PlayerState;
}

export const saveGame = (game: Omit<SavedGame, 'v'>) => {
  try { localStorage.setItem(KEY, JSON.stringify({ ...game, v: VERSION })); } catch { /* sin almacenamiento */ }
};

export const loadGame = (): SavedGame | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const game = JSON.parse(raw) as SavedGame;
    return game.v === VERSION && game.player?.board?.length === 4 ? game : null;
  } catch {
    return null;
  }
};

export const clearGame = () => {
  try { localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ }
};
