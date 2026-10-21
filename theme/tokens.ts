// --- TOKENS DE DIRECCIÓN DE ARTE ---
// Fuente de verdad en código de ART_DIRECTION.md. Los mismos valores existen como
// variables CSS en app/globals.css (--c-*) para usarlos desde estilos.
import { Owner } from '@/types';

// Dirección "impresión analógica nocturna": paleta cerrada de 8 tintas. Las claves
// antiguas se conservan como ROLES (qué es cada cosa) y apuntan a la tinta que toca.
export const INK = {
  black: '#0B0D0C',   // Negro profundo: fondos, vacío, siluetas (dominante)
  slate: '#1E2A28',   // Gris pizarra verdoso
  teal: '#5E7A76',    // Gris azulado apagado: terreno, superficies
  mint: '#B9CFC8',    // Gris menta pálido
  cream: '#EDEBE0',   // Blanco crema: polvo, niebla, luz
  orange: '#FF4A1C',  // Bermellón: ACENTO (rival, peligro, objetivo)
  ember: '#F2652A',   // Naranja cálido: acento secundario (interacción)
  moss: '#6F8F5A',    // Musgo apagado: solo transición en halos
  // Exclusivo de los sellos: verde eléctrico (amarillo verdoso) que brilla como el naranja
  volt: '#7DFF2B',
  voltDark: '#2E6A0E',
  // Exclusivo del Castillo: rojo eléctrico de los jefes evolucionados
  crimson: '#FF1F4B',
  gold: '#E8B64A',
  // Exclusivo del mercader del Castillo y de todo lo que sale de él: azul eléctrico
  azure: '#2E9BFF',
} as const;

export const PALETTE = {
  outline: INK.black,     // Ya no hay contorno: se funde con el negro
  stoneDark: INK.slate,
  floor: INK.teal,
  floorPattern: INK.mint,
  pavement: INK.mint,
  white: INK.cream,
  glass: INK.teal,
  cyan: INK.mint,         // Selección neutra / brillos fríos
  navy: INK.slate,
  roof: INK.ember,
  red: INK.orange,        // Bando rival
  green: INK.slate,       // Bando jugador (silueta oscura)
  yellow: INK.ember,      // Interacción
  wood: INK.slate,
  greenLight: INK.cream,
  greenDark: INK.black,
  redLight: INK.ember,
  redDark: INK.black,
  woodDark: INK.black,
  yellowDark: INK.orange,
  skin: INK.black,        // Personajes: siluetas
  skinShade: INK.black,
  moss: INK.moss,
} as const;

export type PaletteKey = keyof typeof PALETTE;

/**
 * Color de cada bando. `base` = cuerpo, `light` = luz/energía (flechas, brillos),
 * `dark` = sombra. El jugador es una silueta oscura con luz crema; el rival, una masa
 * naranja que brilla.
 */
export const TEAM: Record<Owner, { base: string; light: string; dark: string }> = {
  player: { base: INK.slate, light: INK.cream, dark: INK.black },
  opponent: { base: INK.orange, light: INK.ember, dark: INK.black },
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
