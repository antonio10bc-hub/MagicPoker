// --- EDITOR DE MAZO ---
// Se desbloquea al vencer a todos los jefes. Eliges cuántas copias llevas de cada sello
// (hasta 2, con un máximo en total) y puedes quitar algunas cartas bajas. Sin editar,
// el mazo es el de siempre: el estándar más una carta de cada sello desbloqueado.
import { Card, Rank, SealId } from '@/types';
import { createDeck, createSealCard, shuffle } from '@/lib/game-utils';
import { buildPlayerDeck, isEditorUnlocked, unlockedSeals } from '@/lib/bosses';

const KEY = 'magic_poker_deck';

export interface DeckConfig {
  /** Copias de cada sello (0–MAX_COPIES) */
  seals: Partial<Record<SealId, number>>;
  /** Cartas bajas que has quitado del mazo */
  removed: Rank[];
}

export const MAX_COPIES = 2;
export const MAX_SEALS = 10;
/** Solo se pueden quitar cartas bajas, y pocas */
export const REMOVABLE: Rank[] = ['2', '3', '4', '5'];
export const MAX_REMOVED = 3;

/** Mazo por defecto: una copia de cada sello desbloqueado, sin quitar nada */
export const defaultDeckConfig = (seals: SealId[] = unlockedSeals()): DeckConfig => ({
  seals: Object.fromEntries(seals.map(s => [s, 1])),
  removed: [],
});

export const getDeckConfig = (): DeckConfig | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DeckConfig) : null;
  } catch {
    return null;
  }
};

export const saveDeckConfig = (config: DeckConfig) => {
  try { localStorage.setItem(KEY, JSON.stringify(config)); } catch { /* sin almacenamiento */ }
};

export const clearDeckConfig = () => {
  try { localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ }
};

export const totalSeals = (config: DeckConfig) => Object.values(config.seals).reduce((a, n) => a + (n ?? 0), 0);

/** Ajusta una configuración a las reglas (sellos desbloqueados y límites) */
export const sanitizeDeckConfig = (config: DeckConfig, seals: SealId[] = unlockedSeals()): DeckConfig => {
  const out: DeckConfig = { seals: {}, removed: [] };
  let total = 0;
  seals.forEach(s => {
    const n = Math.max(0, Math.min(MAX_COPIES, config.seals[s] ?? 0, MAX_SEALS - total));
    if (n > 0) out.seals[s] = n;
    total += n;
  });
  out.removed = Array.from(new Set(config.removed.filter(r => REMOVABLE.includes(r)))).slice(0, MAX_REMOVED);
  return out;
};

/** Mazo a partir de una configuración */
export const buildDeckFrom = (config: DeckConfig): Card[] => {
  const removed = new Set(config.removed);
  const seals = (Object.entries(config.seals) as [SealId, number][]).flatMap(([s, n]) => Array.from({ length: n }, () => createSealCard('player', s)));
  return shuffle([...createDeck('player').filter(c => !removed.has(c.rank)), ...seals]);
};

/** Tu mazo para la próxima partida: el editado (si tienes el editor) o el de siempre */
export const buildMatchDeck = (): Card[] => {
  const config = isEditorUnlocked() ? getDeckConfig() : null;
  return config ? buildDeckFrom(sanitizeDeckConfig(config)) : buildPlayerDeck();
};
