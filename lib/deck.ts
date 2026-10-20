// --- EDITOR DE MAZO ---
// Se desbloquea con el primer sello. Puedes quitar hasta 3 cartas cualesquiera del
// mazo y elegir qué sellos llevas: hasta 2 copias de cada uno y 5 en total. Sin
// editar, llevas una copia de cada sello desbloqueado (hasta llenar los 5).
// Cada sello nuevo entra solo en el mazo si aún cabe.
import { Card, Rank, SealId } from '@/types';
import { createDeck, createSealCard, DECK_RANKS, shuffle } from '@/lib/game-utils';
import { buildPlayerDeck, isEditorUnlocked, unlockedSeals } from '@/lib/bosses';

const KEY = 'magic_poker_deck';

export interface DeckConfig {
  /** Copias de cada sello (0–MAX_COPIES) */
  seals: Partial<Record<SealId, number>>;
  /** Cartas que has quitado del mazo */
  removed: Rank[];
}

export const MAX_COPIES = 2;
export const MAX_SEALS = 5;
/** Se puede quitar cualquier carta del mazo, hasta 3 */
export const REMOVABLE: Rank[] = DECK_RANKS;
export const MAX_REMOVED = 3;

/** Mazo por defecto: una copia de cada sello desbloqueado, sin quitar nada */
export const defaultDeckConfig = (seals: SealId[] = unlockedSeals()): DeckConfig => ({
  seals: Object.fromEntries(seals.map(s => [s, 1])),
  removed: [],
});

// --- MAZOS GUARDADOS ---
// Tres ranuras (Mazo 1, 2 y 3): el editor cambia la activa y la partida usa esa.
export const DECK_SLOTS = 3;
const SLOTS_KEY = 'magic_poker_decks';

interface DeckSlots { active: number; slots: (DeckConfig | null)[] }

const readSlots = (): DeckSlots => {
  const empty: DeckSlots = { active: 0, slots: Array(DECK_SLOTS).fill(null) };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(SLOTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DeckSlots;
      return { active: Math.min(DECK_SLOTS - 1, Math.max(0, parsed.active | 0)), slots: Array.from({ length: DECK_SLOTS }, (_, i) => parsed.slots?.[i] ?? null) };
    }
    // Antes había un solo mazo: pasa a la ranura 1
    const old = localStorage.getItem(KEY);
    if (old) return { ...empty, slots: [JSON.parse(old) as DeckConfig, null, null] };
  } catch { /* datos rotos: ranuras vacías */ }
  return empty;
};

const writeSlots = (slots: DeckSlots) => {
  try { localStorage.setItem(SLOTS_KEY, JSON.stringify(slots)); } catch { /* sin almacenamiento */ }
};

export const getActiveSlot = () => readSlots().active;
export const setActiveSlot = (i: number) => writeSlots({ ...readSlots(), active: i });
/** Ranuras con algo guardado */
export const savedSlots = () => readSlots().slots.map(s => s !== null);

/** Configuración del mazo activo (null si esa ranura está vacía) */
export const getDeckConfig = (): DeckConfig | null => {
  const { active, slots } = readSlots();
  return slots[active];
};

export const saveDeckConfig = (config: DeckConfig) => {
  const state = readSlots();
  writeSlots({ ...state, slots: state.slots.map((s, i) => (i === state.active ? config : s)) });
};

/** Vacía la ranura activa (vuelve al mazo por defecto) */
export const clearDeckConfig = () => {
  const state = readSlots();
  writeSlots({ ...state, slots: state.slots.map((s, i) => (i === state.active ? null : s)) });
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

/** Un sello recién desbloqueado entra en el mazo editado si aún cabe */
export const includeNewSeal = (seal: SealId) => {
  const config = getDeckConfig();
  if (!config || totalSeals(config) >= MAX_SEALS || config.seals[seal]) return;
  saveDeckConfig({ ...config, seals: { ...config.seals, [seal]: 1 } });
};

/** Tu mazo para la próxima partida: el editado (si tienes el editor) o el de siempre */
export const buildMatchDeck = (): Card[] => {
  if (!isEditorUnlocked()) return buildPlayerDeck();
  return buildDeckFrom(sanitizeDeckConfig(getDeckConfig() ?? defaultDeckConfig()));
};
