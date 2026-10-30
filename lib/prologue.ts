// --- PRÓLOGO: EL ENTE DEL CLARO ---
// La primera vez, el juego empieza en el mapa, abajo del todo, en un claro a la luz de
// la luna donde nace el camino. Aparece un ente y ofrece enseñarte (ESCUCHAR → tutorial).
// Al volver del tutorial (o al saltarlo), se despide y el camino avanza hasta el
// Forastero. Quien ya había jugado (tutorial hecho o algún jefe vencido) no lo ve.
//   intro    → el ente habla y espera a que escuches
//   farewell → tutorial hecho: se despide y se abre el camino
//   null     → nada que contar
import { getProgress } from './bosses';
import { isTutorialDone } from './tutorial';

const KEY = 'magic_poker_prologue';
export type Prologue = 'intro' | 'farewell';

const listeners = new Set<() => void>();
export const subscribePrologue = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

const read = () => {
  try { return localStorage.getItem(KEY); } catch { return 'done'; }
};
const write = (v: string) => {
  try { localStorage.setItem(KEY, v); } catch { /* sin almacenamiento */ }
};

/** Lo que toca contar ahora (y, la primera vez, se anota) */
export const getPrologue = (): Prologue | null => {
  if (typeof window === 'undefined') return null;
  const raw = read();
  if (raw === 'done') return null;
  if (raw === 'farewell') return 'farewell';
  if (raw === 'intro') return isTutorialDone() ? 'farewell' : 'intro';
  // Sin dato: nuevo si no ha hecho el tutorial ni vencido a nadie
  if (isTutorialDone() || getProgress().defeated > 0) { write('done'); return null; }
  write('intro');
  return 'intro';
};

/** El ente ya se despidió y el camino está abierto */
export const finishPrologue = () => { write('done'); listeners.forEach(l => l()); };
