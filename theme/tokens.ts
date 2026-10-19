// --- TOKENS DE DIRECCIÓN DE ARTE ---
// Fuente de verdad en código de ART_DIRECTION.md. Los mismos valores existen como
// variables CSS en app/globals.css (--c-*) para usarlos desde estilos.
import { Owner } from '@/types';

export const PALETTE = {
  outline: '#1E2638',     // Contorno (nunca negro puro)
  stoneDark: '#4A4E58',   // Piedra oscura / caras frontales en sombra
  floor: '#9AA6AE',       // Suelo gris-azulado
  floorPattern: '#B8C4CC',// Patrón de suelo / brillos fríos
  pavement: '#D8D4CC',    // Pavimento claro
  white: '#F4F4F0',       // Blanco cálido (paneles, cartas)
  glass: '#4C8CD8',       // Cristal azul
  cyan: '#7CC8F0',        // Cian brillante (brillos, selección)
  navy: '#2E3A5C',        // Navy ventanas / fondos de panel
  roof: '#E85A28',        // Naranja tejado
  red: '#C0281C',         // Rojo profundo (bando rival)
  green: '#2E9A3A',       // Verde banderola (bando jugador)
  yellow: '#F0C830',      // Amarillo acento (interacción)
  wood: '#D07830',        // Madera naranja
  // Escalones derivados (cel shading: base + 1 sombra + 1 brillo)
  greenLight: '#5CC860',
  greenDark: '#1E6A2A',
  redLight: '#E8584A',
  redDark: '#801810',
  woodDark: '#985020',
  yellowDark: '#B89010',
  skin: '#F8D0A8',
  skinShade: '#D8A078',
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** Color de cada bando: base, brillo y sombra */
export const TEAM: Record<Owner, { base: string; light: string; dark: string }> = {
  player: { base: PALETTE.green, light: PALETTE.greenLight, dark: PALETTE.greenDark },
  opponent: { base: PALETTE.red, light: PALETTE.redLight, dark: PALETTE.redDark },
};

// --- RESOLUCIÓN INTERNA ---
// Todo el juego se maqueta en píxeles de esta "pantalla" y se escala por enteros.
export const STAGE = { width: 384, height: 288 } as const;

// --- TIPOGRAFÍA (múltiplos de la rejilla de la fuente píxel) ---
export const FONT_SIZE = { body: 10, title: 20 } as const;

// --- TAMAÑOS ---
export const CARD_SIZE = { width: 40, height: 56 } as const;

// --- MOVIMIENTO ---
/** Easing en escalones (estilo "snap" de DS) */
export const steps = (n: number) => (t: number) => Math.min(1, Math.floor(t * n) / (n - 1 || 1));
/** Ease-out rápido */
export const SNAP_EASE: [number, number, number, number] = [0.2, 0.9, 0.3, 1];
/** Duración de un "frame" a 30 fps de referencia */
export const FRAME_MS = 33;
