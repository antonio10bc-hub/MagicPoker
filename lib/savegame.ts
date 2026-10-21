// --- PARTIDA GUARDADA (Local Storage) ---
// Se guarda en cada momento "estable" (tu turno de colocar) para poder retomarla si
// se cierra la app. Se borra al terminar la partida o al salir al menú.
import { Card, Difficulty, PlayerState, SealId } from '@/types';
import { RANKS } from '@/lib/game-utils';
import { ALL_SEALS, BOSSES } from '@/lib/bosses';

const KEY = 'magic_poker_save';
/** Sube al cambiar las reglas: las partidas de versiones anteriores se descartan */
const VERSION = 2;

export interface SavedGame {
  v: number;
  difficulty: Difficulty;
  roundNumber: number;
  /** Boss contra el que se jugaba (partidas antiguas: el actual) */
  bossIndex?: number;
  /** Partida de revancha */
  rematch?: boolean;
  /** Nivel de la revancha */
  rematchLevel?: number;
  /** Pelea del Castillo (el resto de la subida se guarda aparte) */
  castle?: boolean;
  /** El Soberano del Castillo ya pasó a su fase 2 */
  phase2?: boolean;
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
    if (isValid(game)) return game;
  } catch { /* partida rota: se descarta */ }
  clearGame();
  return null;
};

// --- VALIDACIÓN ---
// Una partida antigua o rota (cartas o sellos que ya no existen, tableros raros) se
// descarta en silencio en vez de romper el juego al retomarla.
const isCard = (c: unknown): c is Card => {
  const card = c as Card;
  return !!card && typeof card.id === 'string' && card.rank in RANKS && typeof card.value === 'number'
    && (card.seal === undefined || ALL_SEALS.includes(card.seal as SealId));
};

const isSide = (s: unknown): s is PlayerState => {
  const p = s as PlayerState;
  return !!p && typeof p.lives === 'number' && Array.isArray(p.hand) && Array.isArray(p.deck) && Array.isArray(p.board)
    && p.board.length === 4 && p.hand.every(isCard) && p.deck.every(isCard)
    && p.board.every((slot, i) => slot?.index === i && (slot.card === null || isCard(slot.card)));
};

const isValid = (g: SavedGame) =>
  g?.v === VERSION && isSide(g.player) && isSide(g.opponent) && typeof g.roundNumber === 'number'
  && (g.bossIndex === undefined || (g.bossIndex >= 0 && g.bossIndex < BOSSES.length));

export const clearGame = () => {
  try { localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ }
};
