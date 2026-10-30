import { BOSSES, WINS_FOR_BACK } from '@/lib/bosses';
import { ARCHETYPES } from '@/lib/forest';
import { CHALLENGES } from '@/lib/castle';

// --- MODO DEPURACIÓN (solo para quien lo activa) ---
// Se enciende abriendo la web con ?debug=1 (y se apaga con ?debug=0). Queda guardado en
// este navegador: nadie más lo ve. Da un botón en el menú para repetir las animaciones
// del mapa sin tener que volver a ganar, y para desbloquearlo o bloquearlo todo.
const KEY = 'magic_poker_debug';

/** Lee ?debug=1 / ?debug=0 de la dirección y lo guarda */
export const initDebugFromUrl = () => {
  try {
    const v = new URLSearchParams(window.location.search).get('debug');
    if (v === '1') localStorage.setItem(KEY, '1');
    if (v === '0') localStorage.removeItem(KEY);
  } catch { /* sin almacenamiento */ }
};

export const isDebug = () => {
  try { return typeof window !== 'undefined' && localStorage.getItem(KEY) === '1'; } catch { return false; }
};

// --- DESBLOQUEAR / BLOQUEAR TODO ---
// Escriben el progreso guardado y recargan la página (cada parte del juego lo tiene en
// memoria). Desbloquear: los 12 jefes vencidos con 5 victorias cada uno (sellos,
// colección, editor y dorsos), el Castillo conquistado (con sus tres dorsos), el Bosque abierto con todo el
// bestiario visto y sin animaciones pendientes en el mapa. Bloquear: como recién
// llegado (sin el tutorial, que ya lo hiciste; ajustes y estadísticas se quedan).
const PROGRESS_KEYS = [
  'magic_poker_progress', 'magic_poker_castle', 'magic_poker_forest', 'magic_poker_forest_seen', 'magic_poker_map_seen',
  'magic_poker_save', 'magic_poker_deck', 'magic_poker_decks', 'magic_poker_back',
];

/** Volver a ver el prólogo: como recién llegado, también sin tutorial (recarga) */
export const replayPrologue = () => {
  try {
    [...PROGRESS_KEYS, 'magic_poker_tutorial_done', 'magic_poker_prologue', 'has_played_before'].forEach(k => localStorage.removeItem(k));
  } catch { /* sin almacenamiento */ }
  window.location.reload();
};

export const unlockAll = () => {
  try {
    const castle = JSON.parse(localStorage.getItem('magic_poker_castle') ?? '{}');
    localStorage.setItem('magic_poker_progress', JSON.stringify({ defeated: BOSSES.length, wins: Object.fromEntries(BOSSES.map(b => [b.id, WINS_FOR_BACK])) }));
    localStorage.setItem('magic_poker_castle', JSON.stringify({ ...castle, run: null, best: BOSSES.length, conquered: Math.max(1, castle.conquered ?? 0), legendary: true, bestChallenges: CHALLENGES.length }));
    const forest = JSON.parse(localStorage.getItem('magic_poker_forest') ?? '{}');
    const seen = Object.fromEntries(ARCHETYPES.map(a => [a.id, { [a.tier]: forest.seen?.[a.id]?.[a.tier] ?? { wins: 1, losses: 0 } }]));
    localStorage.setItem('magic_poker_forest', JSON.stringify({ duels: 0, streak: 0, bestStreak: 0, ...forest, seen: { ...forest.seen, ...seen } }));
    localStorage.setItem('magic_poker_forest_seen', '1');
    localStorage.setItem('magic_poker_map_seen', String(BOSSES.length));
    localStorage.setItem('magic_poker_tutorial_done', '1');
    localStorage.setItem('magic_poker_prologue', 'done');
    localStorage.setItem('has_played_before', 'true');
    localStorage.removeItem('magic_poker_save');
  } catch { /* sin almacenamiento */ }
  window.location.reload();
};

export const lockAll = () => {
  try { PROGRESS_KEYS.forEach(k => localStorage.removeItem(k)); } catch { /* sin almacenamiento */ }
  window.location.reload();
};
