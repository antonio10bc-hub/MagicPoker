// Dónde estaba (en coordenadas del escenario) cada carta de la mano justo al jugarla:
// esquina superior izquierda y escala a la que se veía. Así la carta sale volando
// exactamente desde donde la veías y al mismo tamaño, sin "saltos" ni copias.
export interface CardOrigin { x: number; y: number; scale?: number }

export const cardOrigins = new Map<string, CardOrigin>();

/**
 * Mide la carta de la mano en pantalla (seleccionada o arrastrada) y guarda su origen.
 * Se llama justo antes de jugarla.
 */
export const captureOrigin = (cardId: string) => {
  const face = document.querySelector<HTMLElement>(`[data-hand-card="${cardId}"] [data-card-face]`);
  const stage = document.querySelector<HTMLElement>('.stage');
  if (!face || !stage) return;
  const s = stage.getBoundingClientRect();
  const k = s.width / stage.offsetWidth; // píxeles de pantalla por píxel interno
  const r = face.getBoundingClientRect();
  cardOrigins.set(cardId, { x: (r.left - s.left) / k, y: (r.top - s.top) / k, scale: r.width / k / face.offsetWidth });
};
