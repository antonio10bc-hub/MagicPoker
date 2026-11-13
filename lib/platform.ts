// --- PLATAFORMA ---
// La misma web corre en el navegador y dentro de la app de escritorio (Electron, para
// Steam). Lo que cambia entre las dos se decide aquí.

/** Versión de escritorio (build con DESKTOP=1) */
export const IS_DESKTOP = process.env.NEXT_PUBLIC_DESKTOP === '1';
/** Web estática para jugar en el navegador fuera de nuestra web (itch.io, build con
 *  WEB_EXPORT=1): sin servidor, sin service worker y sin analíticas */
export const IS_STATIC_WEB = process.env.NEXT_PUBLIC_STATIC_WEB === '1';

/** Lo que la app de escritorio le da al juego (desktop/preload.js) */
interface DesktopBridge {
  quit: () => void;
  setFullscreen: (on: boolean) => void;
  isFullscreen: () => Promise<boolean>;
  onFullscreen: (cb: (on: boolean) => void) => () => void;
}

export const desktop = (): DesktopBridge | null =>
  (typeof window !== 'undefined' && (window as unknown as { desktop?: DesktopBridge }).desktop) || null;
