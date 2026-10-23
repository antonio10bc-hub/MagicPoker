// --- MODO DEPURACIÓN (solo para quien lo activa) ---
// Se enciende abriendo la web con ?debug=1 (y se apaga con ?debug=0). Queda guardado en
// este navegador: nadie más lo ve. Da un botón en el menú para repetir las animaciones
// del mapa sin tener que volver a ganar.
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
