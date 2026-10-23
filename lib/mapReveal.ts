// --- MAPA DEL MENÚ: LO QUE YA SE HA ENSEÑADO ---
// El mapa recuerda hasta qué jefe vencido ha enseñado. Si al volver al menú hay más
// vencidos que enseñados, se cuenta lo nuevo por pasos (ver revealSteps) con el input
// bloqueado, y al acabar se anota. La primera vez (sin dato) se toma lo que haya, sin
// animación, para no repetir toda la historia a quien ya jugaba.
import { BOSSES } from '@/lib/bosses';

const KEY = 'magic_poker_map_seen';

export const getMapSeen = (defeated: number): number => {
  try {
    const raw = localStorage.getItem(KEY);
    const n = raw === null ? NaN : Number(raw);
    // Sin dato, o progreso borrado: se parte de lo que hay
    if (!Number.isFinite(n) || n > defeated) {
      localStorage.setItem(KEY, String(defeated));
      return defeated;
    }
    return n;
  } catch {
    return defeated;
  }
};

/** Lo anotado, sin tocar nada (null si aún no hay dato) */
export const peekMapSeen = (): number | null => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === null || !Number.isFinite(Number(raw)) ? null : Number(raw);
  } catch {
    return null;
  }
};

export const setMapSeen = (n: number) => {
  try { localStorage.setItem(KEY, String(n)); } catch { /* sin almacenamiento */ }
};

/** Lo que pasa tras vencer al jefe `beaten`: el siguiente asoma, despierta el secreto o se alza el Castillo */
export type RevealStep = { beaten: number; then: 'next' | 'secret' | 'castle' };

export const revealSteps = (seen: number, defeated: number): RevealStep[] =>
  Array.from({ length: Math.max(0, defeated - seen) }, (_, i) => {
    const beaten = seen + i;
    const next = BOSSES[beaten + 1];
    return { beaten, then: !next ? 'castle' : next.secret ? 'secret' : 'next' };
  });
