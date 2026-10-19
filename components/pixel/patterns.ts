import { Owner } from '@/types';
import { Sprite, spriteToDataUri } from './PixelSprite';

// --- TEXTURAS PROCEDURALES EN MOSAICO ---
// Cada función genera una baldosa pequeña (8–16 px) a partir de una regla geométrica.
// Se usan como `background-image` y se repiten con bordes duros.

const tile = (w: number, h: number, pick: (x: number, y: number) => string): Sprite => ({
  rows: Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => pick(x, y)).join('')),
});

/** Suelo de plaza: baldosa 16×16 con rombo en dos tonos próximos y junta de 1 px */
export const FLOOR_TILE = tile(16, 16, (x, y) => {
  if (x === 15 || y === 15) return 'l';
  const d = Math.abs(x - 7) + Math.abs(y - 7);
  if (d === 5) return 'l';
  if (d === 1 && (x + y) % 2 === 0) return 'l';
  return 'g';
});

/** Greca (meandro) 8×8 para franjas decorativas */
export const MEANDER_TILE = tile(8, 8, (x, y) => {
  const key = [
    'pppppppd',
    'pddddddd',
    'pdppppp.',
    'pdpdddp.',
    'pdpdpdp.',
    'pdpppdp.',
    'pdddddp.',
    'ppppppp.',
  ][y][x];
  return key === '.' ? 'p' : key;
});

/** Pavimento exterior: ladrillo a matajunta 16×8 */
export const PAVEMENT_TILE = tile(16, 8, (x, y) => {
  if (y === 3 || y === 7) return 'l';
  if (y < 3 && x === 15) return 'l';
  if (y > 3 && y < 7 && x === 7) return 'l';
  return 'p';
});

/** Cara frontal de piedra: sillares 12×6 */
export const STONE_FACE_TILE = tile(12, 6, (x, y) => {
  if (y === 5) return 'o';
  if (y === 0) return 'g';
  if ((y < 3 && x === 11) || (y >= 3 && x === 5)) return 'o';
  return 'd';
});

/** Dorso de carta: celosía de rombos 8×8 en el color del bando */
export const CARD_BACK_TILE = tile(8, 8, (x, y) => {
  const d = Math.abs(x - 3.5) + Math.abs(y - 3.5);
  if (d >= 3 && d < 4) return 't';
  if (d < 1.5) return 'u';
  return 'n';
});

/** Fondo de ventana de ilustración: damero suave 4×4 */
export const WINDOW_TILE = tile(4, 4, (x, y) => ((x < 2) === (y < 2) ? 'w' : 'c'));

/** Fondo de pantalla fuera del escenario (letterbox) */
export const LETTERBOX_TILE = tile(8, 8, (x, y) => ((x + y) % 8 === 0 ? 'n' : 'o'));

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
