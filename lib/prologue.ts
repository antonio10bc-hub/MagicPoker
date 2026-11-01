// --- PRÓLOGO: EL PASEO CON EL ENTE ---
// La primera vez, el juego empieza en el mapa, abajo del todo, en un claro a la luz de
// la luna. Aparece un ente y te lleva de paseo por el bosque: en cada parada del camino
// hay una carta tirada (el 6, el Príncipe, la Reina, el Rey, el Joker y el As) y con
// cada una jugáis una mano de un solo turno (ver LESSONS en lib/tutorial). En la última
// parada te reta a un duelo. Al ganarlo (o al saltar el tutorial), se despide y el
// camino se abre hasta el Forastero. Quien ya había jugado no lo ve.
//
// Lo que se guarda (`magic_poker_prologue`):
//   intro          → en el claro: el humo, el ente, y SEGUIR
//   stage:N        → en la parada N (0–5, lecciones; 6, el duelo). Con `walk`, aún hay que
//                    andar hasta ella desde la anterior (o desde el claro)
//   farewell:N     → tutorial hecho: se despide en la parada N (-1: en el claro)
//   done           → nada que contar
// getPrologue devuelve eso mismo como texto (p. ej. "stage:2:walk"), para el menú.
import { getProgress } from './bosses';
import { isTutorialDone, LESSONS } from './tutorial';

const KEY = 'magic_poker_prologue';
const WALK_KEY = 'magic_poker_prologue_walk';
/** La parada del duelo (después de las lecciones) */
export const DUEL_STAGE = LESSONS.length;

const listeners = new Set<() => void>();
export const subscribePrologue = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const notify = () => listeners.forEach(l => l());

const read = (k = KEY) => {
  try { return localStorage.getItem(k); } catch { return 'done'; }
};
const write = (v: string, k = KEY) => {
  try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ }
};
const stageOf = (raw: string | null) => (raw?.startsWith('stage:') ? Number(raw.slice(6)) : raw === 'intro' ? -1 : null);

/** Lo que toca ahora (y, la primera vez, se anota). null: nada */
export const getPrologue = (): string | null => {
  if (typeof window === 'undefined') return null;
  const raw = read();
  if (raw === 'done') return null;
  if (raw?.startsWith('farewell')) return raw;
  const stage = stageOf(raw);
  if (stage !== null) {
    // Tutorial hecho (duelo ganado o saltado): se despide donde estuviera
    if (isTutorialDone()) { write(`farewell:${stage}`); return `farewell:${stage}`; }
    return raw === 'intro' ? 'intro' : `stage:${stage}${read(WALK_KEY) === '1' ? ':walk' : ''}`;
  }
  // Sin dato: nuevo si no ha hecho el tutorial ni vencido a nadie
  if (isTutorialDone() || getProgress().defeated > 0) { write('done'); return null; }
  write('intro');
  return 'intro';
};

/** Del claro, a andar hasta la primera parada */
export const startWalk = () => { write('stage:0'); write('1', WALK_KEY); notify(); };
/** Lección superada: a la siguiente parada (andando) */
export const completeLesson = () => {
  const stage = stageOf(read());
  if (stage === null || stage < 0) return;
  write(`stage:${Math.min(DUEL_STAGE, stage + 1)}`);
  write('1', WALK_KEY);
  notify();
};
/** Ya ha llegado andando a la parada */
export const walked = () => { write('0', WALK_KEY); notify(); };
/** El ente ya se despidió y el camino está abierto */
export const finishPrologue = () => { write('done'); notify(); };

// Tocar la pantalla mientras el humo espera: el menú tiene encima su capa que bloquea el
// input durante las escenas, así que el toque llega por aquí hasta el mapa
let poke: (() => void) | null = null;
export const onProloguePoke = (fn: (() => void) | null) => { poke = fn; };
export const pokePrologue = () => poke?.();
