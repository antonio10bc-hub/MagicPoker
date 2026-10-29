import { useSyncExternalStore } from 'react';

// --- AVISO DE "NUEVO" ---
// Punto naranja que late en la esquina de un botón recién desbloqueado (grimorio,
// editor de mazo). Se quita para siempre la primera vez que se abre.

export type NewThing = 'collection' | 'deck';

const KEY = (what: NewThing) => `magicpoker_seen_${what}`;
const listeners = new Set<() => void>();

const isSeen = (what: NewThing) => {
  try { return localStorage.getItem(KEY(what)) === '1'; } catch { return true; }
};

/** Se ha abierto: fuera el aviso */
export const markSeen = (what: NewThing) => {
  if (isSeen(what)) return;
  try { localStorage.setItem(KEY(what), '1'); } catch { /* sin almacenamiento: el aviso vuelve la próxima vez */ }
  listeners.forEach(l => l());
};

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Punto de aviso (el botón que lo lleva tiene que ser `relative`) */
export const NewDot = ({ what }: { what: NewThing }) => {
  const seen = useSyncExternalStore(subscribe, () => isSeen(what), () => true);
  if (seen) return null;
  return (
    <span className="absolute pointer-events-none rounded-full anim-throb" data-new={what}
      style={{ right: -2, top: -2, width: 5, height: 5, background: 'var(--ink-orange)', boxShadow: '0 0 0 1px var(--ink-black), 0 0 4px 1px rgba(255,74,28,0.7)' }} />
  );
};
