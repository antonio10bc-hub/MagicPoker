// --- DORSOS DE CARTA (Local Storage, con suscripción) ---
// Cada jefe tiene su dorso temático: lo usan sus cartas y tú lo ganas al vencerle 5
// veces (ver lib/bosses). Aquí se guarda cuál llevas tú ('default' = el de siempre).
import { useSyncExternalStore } from 'react';

const KEY = 'magic_poker_back';
export const DEFAULT_BACK = 'default';

const listeners = new Set<() => void>();
let cached: string | null = null;

export const getBack = (): string => {
  if (typeof window === 'undefined') return DEFAULT_BACK;
  if (cached === null) {
    try { cached = localStorage.getItem(KEY) ?? DEFAULT_BACK; } catch { cached = DEFAULT_BACK; }
  }
  return cached;
};

export const setBack = (id: string) => {
  cached = id;
  try { localStorage.setItem(KEY, id); } catch { /* sin almacenamiento */ }
  listeners.forEach(l => l());
};

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Dorso que llevas (se actualiza al cambiarlo en la colección) */
export const usePlayerBack = () => useSyncExternalStore(subscribe, getBack, () => DEFAULT_BACK);
