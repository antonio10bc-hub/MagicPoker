import { Owner } from '@/types';
import { Sprite, spriteToDataUri } from './PixelSprite';

// --- TEXTURAS PROCEDURALES EN MOSAICO ---
// Tramas estocásticas (punteado aleatorio, como tinta de risografía) en baldosas
// pequeñas que se repiten. Son deterministas para que servidor y cliente coincidan.
// Las letras son roles de la paleta (ver PixelSprite): o negro, d pizarra, g teal,
// l menta, w crema, x naranja, a brasa, t/T/u color del bando.

const tile = (w: number, h: number, pick: (x: number, y: number) => string): Sprite => ({
  rows: Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => pick(x, y)).join('')),
});

/** Ruido determinista por coordenada (sin estado: no depende del orden de llamada) */
const hash = (x: number, y: number, seed: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
};

/** Baldosa de grano: cada píxel elige la primera capa cuyo umbral supera */
const grain = (size: number, seed: number, base: string, layers: [string, number | ((x: number, y: number) => number)][]) =>
  tile(size, size, (x, y) => {
    let k = base;
    layers.forEach(([key, density], li) => {
      const d = typeof density === 'number' ? density : density(x, y);
      if (hash(x, y, seed + li * 13) < d) k = key;
    });
    return k;
  });

/** Suelo jugable: pizarra con grano teal y alguna mota clara (sin dibujo) */
export const FLOOR_TILE = grain(16, 1, 'd', [['o', 0.32], ['g', 0.1], ['l', 0.004]]);

/** Franja central: línea de niebla tenue (más densa en el centro de la banda) */
export const MEANDER_TILE = tile(8, 8, (x, y) => {
  const d = 1 - Math.abs(y - 3.5) / 4;
  const r = hash(x, y, 7);
  return r < d * 0.35 ? 'w' : r < d * 0.7 ? 'l' : r < 0.85 ? 'g' : 'd';
});

/** Borde del diorama: teal apagado con grano */
export const PAVEMENT_TILE = grain(16, 3, 'g', [['d', 0.55], ['o', 0.12], ['l', 0.04]]);

/** Cara frontal: casi negra, en sombra */
export const STONE_FACE_TILE = grain(12, 5, 'o', [['d', 0.38], ['g', 0.04]]);

/** Dorso de carta: masa del color del bando, granulada */
export const CARD_BACK_TILE = grain(16, 9, 't', [['T', 0.35], ['u', 0.12], ['w', 0.03]]);

/** Ventana de ilustración (por defecto): niebla crema-menta granulada */
export const WINDOW_TILE = grain(8, 11, 'l', [['w', 0.45], ['g', 0.1]]);

/** Fondo de pantalla fuera del escenario (letterbox) */
export const LETTERBOX_TILE = grain(8, 13, 'o', [['d', 0.1]]);

const cache = new Map<string, string>();
export const patternUri = (name: string, sprite: Sprite, owner: Owner = 'player'): string => {
  const key = `${name}:${owner}`;
  let uri = cache.get(key);
  if (!uri) {
    uri = spriteToDataUri(sprite, owner);
    cache.set(key, uri);
  }
  return uri;
};
