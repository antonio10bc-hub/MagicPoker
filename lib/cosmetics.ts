// --- DORSOS DE CARTA (Local Storage, con suscripción) ---
// Cada jefe tiene su dorso temático: lo usan sus cartas y tú lo ganas al vencerle 5
// veces (ver lib/bosses). Cada mazo guardado lleva el suyo (lib/deck); un mazo sin dorso
// propio usa el que llevabas antes de que hubiera uno por mazo ('default' = el de siempre).
import { useSyncExternalStore } from 'react';
import { track } from '@/lib/analytics';
import { getSlotBack, setSlotBack, subscribeSlots } from '@/lib/deck';

const KEY = 'magic_poker_back';
export const DEFAULT_BACK = 'default';

const listeners = new Set<() => void>();
let cached: string | null = null;

/** El de antes de los dorsos por mazo */
const legacyBack = () => {
  try { return localStorage.getItem(KEY) ?? DEFAULT_BACK; } catch { return DEFAULT_BACK; }
};

export const getBack = (): string => {
  if (typeof window === 'undefined') return DEFAULT_BACK;
  if (cached === null) cached = getSlotBack() ?? legacyBack();
  return cached;
};

/** Pone el dorso del mazo activo */
export const setBack = (id: string) => {
  track('back_equipped', { back: id });
  setSlotBack(id);
};

// Al cambiar de mazo o de dorso se vuelve a mirar cuál toca
if (typeof window !== 'undefined') subscribeSlots(() => { cached = null; listeners.forEach(l => l()); });

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Dorso que llevas: el del mazo activo (se actualiza al cambiar de mazo o de dorso) */
export const usePlayerBack = () => useSyncExternalStore(subscribe, getBack, () => DEFAULT_BACK);
