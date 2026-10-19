// --- AJUSTES DEL JUGADOR (Local Storage) ---
// Pequeño almacén con suscripción, para usarlo con useSyncExternalStore.

export type GrainLevel = 'full' | 'soft' | 'off';

export interface Settings {
  /** 0–1 */
  music: number;
  /** 0–1 */
  sfx: number;
  vibration: boolean;
  /** Postprocesado: grano completo, suave o apagado (modo rendimiento) */
  grain: GrainLevel;
}

const KEY = 'magic_poker_settings';
const DEFAULTS: Settings = { music: 0.7, sfx: 0.9, vibration: true, grain: 'full' };

const listeners = new Set<() => void>();
let current: Settings = DEFAULTS;
let loaded = false;

const load = () => {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) current = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch { /* sin almacenamiento: valores por defecto */ }
};

export const getSettings = (): Settings => {
  load();
  return current;
};

export const getServerSettings = (): Settings => DEFAULTS;

export const updateSettings = (patch: Partial<Settings>) => {
  current = { ...getSettings(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* sin almacenamiento */ }
  listeners.forEach(l => l());
};

export const subscribeSettings = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
