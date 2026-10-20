// --- RELOJ DE LA PARTIDA (pausa y velocidad) ---
// Los retardos de la partida pasan por aquí para poder pausarlos:
//  · gameTimeout: las esperas del juego (turno del rival, fases del combate, cuenta
//    atrás). A velocidad x2 duran la mitad.
//  · pausableTimeout: la coreografía de la pelea (impactos, sellos rotos, bocadillos),
//    que va atada a las animaciones y por eso no cambia de velocidad.
// Las animaciones no se aceleran: escalar el reloj de Framer Motion dejaba animaciones
// de salida sin terminar y la partida se atascaba.

export type GameSpeed = 1 | 2;

let speed: GameSpeed = 1;
let paused = false;

interface Timer { fn: () => void; remaining: number; started: number; scaled: boolean; id?: ReturnType<typeof setTimeout> }
const timers = new Set<Timer>();

const arm = (t: Timer) => {
  if (paused) return;
  t.started = Date.now();
  t.id = setTimeout(() => { timers.delete(t); t.fn(); }, t.remaining);
};

const add = (fn: () => void, ms: number, scaled: boolean): (() => void) => {
  const t: Timer = { fn, remaining: scaled ? ms / speed : ms, started: Date.now(), scaled };
  timers.add(t);
  arm(t);
  return () => { clearTimeout(t.id); timers.delete(t); };
};

/** Espera del juego: respeta la pausa y la velocidad. Devuelve cómo cancelarla. */
export const gameTimeout = (fn: () => void, ms: number) => add(fn, ms, true);

/** Retardo visual: respeta la pausa, no la velocidad. Devuelve cómo cancelarlo. */
export const pausableTimeout = (fn: () => void, ms: number) => add(fn, ms, false);

export const isPaused = () => paused;

export const setPaused = (value: boolean) => {
  if (value === paused) return;
  paused = value;
  timers.forEach(t => {
    if (value) {
      clearTimeout(t.id);
      t.remaining = Math.max(0, t.remaining - (Date.now() - t.started));
    } else {
      arm(t);
    }
  });
};

export const getSpeed = () => speed;

export const setSpeed = (value: GameSpeed) => {
  if (value === speed) return;
  // Las esperas pendientes se reescalan a la nueva velocidad
  timers.forEach(t => {
    if (!t.scaled) return;
    clearTimeout(t.id);
    const left = paused ? t.remaining : Math.max(0, t.remaining - (Date.now() - t.started));
    t.remaining = (left * speed) / value;
    arm(t);
  });
  speed = value;
};

// Tests visuales: en desarrollo se puede consultar el reloj desde la página
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as { __clock: object }).__clock = { isPaused, getSpeed, pending: () => timers.size };
}
