// --- RELOJ DE LA PARTIDA (pausa y velocidad) ---
// Los retardos de la partida (turno del rival, fases del combate, coreografía de la
// pelea, cuenta atrás) pasan por `gameTimeout`: se pueden pausar y van más deprisa
// a velocidad x2. Las animaciones también se aceleran: Framer Motion mide el tiempo
// con performance.now(), así que se le da un reloj escalado, y las animaciones CSS
// reciben la misma velocidad (playbackRate).

export type GameSpeed = 1 | 2;

let speed: GameSpeed = 1;
let paused = false;

interface Timer { fn: () => void; remaining: number; started: number; id?: ReturnType<typeof setTimeout> }
const timers = new Set<Timer>();

const arm = (t: Timer) => {
  if (paused) return;
  t.started = Date.now();
  t.id = setTimeout(() => { timers.delete(t); t.fn(); }, t.remaining);
};

/** setTimeout de la partida: respeta la pausa y la velocidad. Devuelve cómo cancelarlo. */
export const gameTimeout = (fn: () => void, ms: number): (() => void) => {
  const t: Timer = { fn, remaining: ms / speed, started: Date.now() };
  timers.add(t);
  arm(t);
  return () => { clearTimeout(t.id); timers.delete(t); };
};

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

// --- VELOCIDAD DE LAS ANIMACIONES ---
let realNow: (() => number) | null = null;
let realBase = 0;
let virtualBase = 0;
let cssSync: ReturnType<typeof setInterval> | null = null;

const syncCss = () => {
  document.getAnimations?.().forEach(a => { if (a.playbackRate !== speed) a.playbackRate = speed; });
};

export const getSpeed = () => speed;

export const setSpeed = (value: GameSpeed) => {
  if (typeof window === 'undefined' || value === speed) return;
  // Reloj escalado (se instala una vez); al cambiar de velocidad se rebasa para que
  // el tiempo no salte
  if (!realNow) {
    realNow = performance.now.bind(performance);
    realBase = virtualBase = realNow();
    performance.now = () => virtualBase + (realNow!() - realBase) * speed;
  }
  virtualBase = performance.now();
  realBase = realNow();
  // Los temporizadores pendientes se reescalan
  timers.forEach(t => {
    clearTimeout(t.id);
    const left = paused ? t.remaining : Math.max(0, t.remaining - (Date.now() - t.started));
    t.remaining = (left * speed) / value;
  });
  speed = value;
  timers.forEach(arm);
  if (cssSync) clearInterval(cssSync);
  cssSync = null;
  syncCss();
  if (speed !== 1) cssSync = setInterval(syncCss, 150);
};

// Tests visuales: en desarrollo se puede consultar el reloj desde la página
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as { __clock: object }).__clock = { isPaused, getSpeed, pending: () => timers.size };
}
