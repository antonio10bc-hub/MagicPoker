// --- EDITOR DE MAZO ---
// Se desbloquea con el primer sello (al vencer al Muro). Puedes quitar hasta 3 cartas del
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
// Cada ranura lleva además su dorso (aparte de la configuración: restablecer el mazo
// no lo quita).
export const DECK_SLOTS = 3;
const SLOTS_KEY = 'magic_poker_decks';

interface DeckSlots { active: number; slots: (DeckConfig | null)[]; backs?: (string | null)[] }

const readSlots = (): DeckSlots => {
  const empty: DeckSlots = { active: 0, slots: Array(DECK_SLOTS).fill(null) };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(SLOTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DeckSlots;
      return {
        active: Math.min(DECK_SLOTS - 1, Math.max(0, parsed.active | 0)),
        slots: Array.from({ length: DECK_SLOTS }, (_, i) => parsed.slots?.[i] ?? null),
        backs: Array.from({ length: DECK_SLOTS }, (_, i) => parsed.backs?.[i] ?? null),
      };
    }
    // Antes había un solo mazo: pasa a la ranura 1
    const old = localStorage.getItem(KEY);
    if (old) return { ...empty, slots: [JSON.parse(old) as DeckConfig, null, null] };
  } catch { /* datos rotos: ranuras vacías */ }
  return empty;
};

const slotListeners = new Set<() => void>();
/** Avisa al cambiar de mazo activo o de dorso (el dorso que llevas depende de los dos) */
export const subscribeSlots = (l: () => void) => { slotListeners.add(l); return () => { slotListeners.delete(l); }; };

const writeSlots = (slots: DeckSlots) => {
  try { localStorage.setItem(SLOTS_KEY, JSON.stringify(slots)); } catch { /* sin almacenamiento */ }
  slotListeners.forEach(l => l());
};

/** Dorso de una ranura (por defecto, la activa); null si no tiene uno propio */
export const getSlotBack = (i = readSlots().active): string | null => readSlots().backs?.[i] ?? null;
/** Pone el dorso de la ranura activa */
export const setSlotBack = (id: string) => {
  const state = readSlots();
  const backs = Array.from({ length: DECK_SLOTS }, (_, i) => (i === state.active ? id : state.backs?.[i] ?? null));
  writeSlots({ ...state, backs });
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

// --- COPIAR Y PEGAR MAZOS ---
// Un mazo se copia como un código corto de texto (va al portapapeles y se guarda
// también aquí, por si el navegador no deja leer el portapapeles):
//   MP1:shield*2.anchor*2|2.3   → sellos con sus copias | cartas quitadas
const CODE_PREFIX = 'MP1:';
const CLIP_KEY = 'magic_poker_deck_clip';

export const encodeDeck = (config: DeckConfig): string => {
  const seals = (Object.entries(config.seals) as [SealId, number][]).filter(([, n]) => n > 0).map(([s, n]) => `${s}*${n}`).join('.');
  return `${CODE_PREFIX}${seals}|${config.removed.join('.')}`;
};

/** Lee un código de mazo (null si no lo es) */
export const decodeDeck = (text: string): DeckConfig | null => {
  const code = text.trim();
  if (!code.startsWith(CODE_PREFIX)) return null;
  const [sealPart = '', removedPart = ''] = code.slice(CODE_PREFIX.length).split('|');
  const seals: DeckConfig['seals'] = {};
  for (const item of sealPart.split('.').filter(Boolean)) {
    const [seal, n] = item.split('*');
    const copies = Number(n);
    if (!seal || !Number.isFinite(copies)) return null;
    seals[seal as SealId] = copies;
  }
  const removed = removedPart.split('.').filter(Boolean) as Rank[];
  return { seals, removed };
};

/** Copia un mazo: al portapapeles (si se puede) y al del juego */
export const copyDeck = (config: DeckConfig) => {
  const code = encodeDeck(config);
  try { localStorage.setItem(CLIP_KEY, code); } catch { /* sin almacenamiento */ }
  try { void navigator.clipboard?.writeText(code).catch(() => {}); } catch { /* sin portapapeles */ }
  return code;
};

/**
 * El mazo copiado: primero el del juego (lo último que copiaste aquí); si no hay, el
 * portapapeles del sistema (algunos navegadores piden permiso o no contestan: se espera
 * poco).
 */
export const readCopiedDeck = async (): Promise<DeckConfig | null> => {
  try {
    const saved = localStorage.getItem(CLIP_KEY);
    const fromGame = saved ? decodeDeck(saved) : null;
    if (fromGame) return fromGame;
  } catch { /* sin almacenamiento */ }
  try {
    const text = await Promise.race([
      navigator.clipboard?.readText() ?? Promise.resolve(''),
      new Promise<string>(resolve => setTimeout(() => resolve(''), 800)),
    ]);
    return text ? decodeDeck(text) : null;
  } catch {
    return null;
  }
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
