// --- CALIDAD GRÁFICA (modo bajo consumo) ---
// En un ordenador potente todo va sobrado; en un móvil o un portátil flojo, el grano
// de película (mezcla a pantalla completa), la niebla que hierve y los bucles
// decorativos hunden los fps. En "auto" el juego mide sus propios fotogramas al
// arrancar: si no llega, pasa a bajo consumo y lo recuerda para la próxima vez.
// El jugador puede forzar alta o baja en Ajustes.
import { useSyncExternalStore } from 'react';
import { getSettings, subscribeSettings } from '@/lib/settings';
import { track } from '@/lib/analytics';

const KEY = 'magic_poker_low_power';
/** Por debajo de esto (de media en una ventana de medida), el dispositivo va justo */
const MIN_FPS = 42;
const WINDOW_MS = 3000;
/** Ventanas de medida al arrancar (si alguna no llega, bajo consumo) */
const WINDOWS = 3;

const listeners = new Set<() => void>();
let started = false;
let detected: boolean | null = null;

const readDetected = () => {
  if (detected === null) {
    try { detected = localStorage.getItem(KEY) === '1'; } catch { detected = false; }
  }
  return detected;
};

export const isLowPower = (): boolean => {
  if (typeof window === 'undefined') return false;
  const { quality } = getSettings();
  return quality === 'low' || (quality === 'auto' && readDetected());
};

const apply = () => {
  document.documentElement.classList.toggle('low-power', isLowPower());
  listeners.forEach(l => l());
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

export const useLowPower = () => useSyncExternalStore(subscribe, isLowPower, () => false);

/** Mide fps durante una ventana (solo con la pestaña a la vista) */
const measure = () => new Promise<number | null>(resolve => {
  let frames = 0;
  let start = 0;
  const frame = (now: number) => {
    if (document.hidden) return resolve(null);
    if (!start) start = now;
    else frames++;
    if (now - start < WINDOW_MS) requestAnimationFrame(frame);
    else resolve((frames * 1000) / (now - start));
  };
  requestAnimationFrame(frame);
});

/** Arranca una vez: aplica lo guardado y, en auto, mide si hace falta bajar */
export const startQualityProbe = () => {
  if (started) return;
  started = true;
  apply();
  subscribeSettings(apply);
  if (readDetected()) return;
  let left = WINDOWS;
  const next = async () => {
    if (getSettings().quality !== 'auto' || left-- <= 0) return;
    const fps = await measure();
    if (fps !== null && fps < MIN_FPS) {
      detected = true;
      try { localStorage.setItem(KEY, '1'); } catch { /* sin almacenamiento */ }
      track('low_power_enabled', { fps: Math.round(fps) });
      apply();
      return;
    }
    // Entre medidas, un respiro (y si la pestaña estaba oculta, se repite)
    setTimeout(next, fps === null ? 4000 : 6000);
  };
  // Tras la pantalla de carga: lo que cuesta arrancar no cuenta
  setTimeout(next, 2500);
};
