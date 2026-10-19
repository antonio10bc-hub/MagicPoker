import { CSSProperties, ReactNode } from 'react';
import { Owner } from '@/types';
import { PixelSprite, Sprite, spriteSize } from '@/components/pixel/PixelSprite';
import { Rect } from './types';

// --- PIEZAS MODULARES DE ESCENARIO ---
// Cada escenario se compone con estas piezas en capas:
// suelo → bordes/caras → objetos del entorno → cartas → interfaz.

const box = (r: Rect): CSSProperties => ({ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h });

/** Superficie con textura en mosaico */
export const Surface = ({ rect, texture, tileSize, color, style, children }: {
  rect: Rect; texture?: string; tileSize?: number; color?: string; style?: CSSProperties; children?: ReactNode;
}) => (
  <div style={{
    ...box(rect),
    backgroundColor: color,
    backgroundImage: texture,
    backgroundSize: tileSize ? `${tileSize}px` : undefined,
    ...style,
  }}>
    {children}
  </div>
);

/**
 * Plataforma-diorama: cara superior (borde + suelo), cara frontal con grosor y sombra
 * proyectada abajo-derecha. `floor` es la textura del suelo jugable.
 */
export const Platform = ({ rect, rim = 4, faceHeight = 14, floor, floorTile = 16, rimColor, faceTexture }: {
  rect: Rect; rim?: number; faceHeight?: number; floor: string; floorTile?: number; rimColor: string; faceTexture: string;
}) => {
  const top: Rect = { x: rect.x, y: rect.y, w: rect.w, h: rect.h - faceHeight };
  return (
    <>
      {/* Sombra proyectada (mancha semitransparente desplazada abajo-derecha) */}
      <div style={{ ...box({ x: rect.x + 4, y: rect.y + 6, w: rect.w, h: rect.h }), background: 'var(--c-shadow)' }} />
      {/* Cara frontal */}
      <Surface
        rect={{ x: rect.x, y: top.y + top.h, w: rect.w, h: faceHeight }}
        texture={faceTexture}
        tileSize={12}
        style={{ boxShadow: 'inset 0 0 0 1px var(--c-outline)' }}
      />
      {/* Cara superior: borde claro con bisel */}
      <div style={{
        ...box(top),
        background: rimColor,
        boxShadow: 'inset 0 0 0 1px var(--c-outline), inset 1px 1px 0 1px var(--c-white), inset -1px -1px 0 1px var(--c-floor)',
      }} />
      {/* Suelo jugable, encastrado (sombra interior arriba-izquierda) */}
      <Surface
        rect={{ x: top.x + rim, y: top.y + rim, w: top.w - rim * 2, h: top.h - rim * 2 }}
        texture={floor}
        tileSize={floorTile}
        style={{ boxShadow: 'inset 0 0 0 1px var(--c-outline), inset 1px 1px 0 1px var(--c-stone-dark)' }}
      />
    </>
  );
};

/** Franja decorativa con bisel (p. ej. greca central) */
export const Strip = ({ rect, texture, tileSize = 8 }: { rect: Rect; texture: string; tileSize?: number }) => (
  <Surface
    rect={rect}
    texture={texture}
    tileSize={tileSize}
    style={{ boxShadow: 'inset 0 0 0 1px var(--c-outline), 0 1px 0 0 var(--c-white)' }}
  />
);

/** Barandilla de madera con balaustres (luz arriba-izquierda) */
export const Railing = ({ x, y, w, h = 13 }: { x: number; y: number; w: number; h?: number }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: h }}>
    {/* Balaustres */}
    <div style={{
      position: 'absolute', left: 0, right: 0, top: 3, bottom: 2,
      backgroundImage: 'repeating-linear-gradient(90deg, var(--c-outline) 0 1px, var(--c-wood) 1px 2px, var(--c-wood-dark) 2px 3px, var(--c-outline) 3px 4px, transparent 4px 7px)',
    }} />
    {/* Pasamanos */}
    <div style={{
      position: 'absolute', left: 0, right: 0, top: 0, height: 4,
      background: 'var(--c-wood)',
      boxShadow: 'inset 0 0 0 1px var(--c-outline), inset 0 1px 0 1px #F0A060, inset 0 -1px 0 1px var(--c-wood-dark)',
    }} />
    {/* Zócalo */}
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, height: 3,
      background: 'var(--c-wood-dark)',
      boxShadow: 'inset 0 0 0 1px var(--c-outline)',
    }} />
  </div>
);

/** Objeto del entorno con su sombra elíptica a los pies. (x, y) = base del objeto */
export const Prop = ({ sprite, x, y, owner, shadow = true }: { sprite: Sprite; x: number; y: number; owner?: Owner; shadow?: boolean }) => {
  const { width, height } = spriteSize(sprite);
  return (
    <>
      {shadow && (
        <div style={{
          position: 'absolute', left: x + 1, top: y - 3, width: width + 2, height: 5,
          background: 'var(--c-shadow)', borderRadius: '50%',
        }} />
      )}
      <PixelSprite sprite={sprite} owner={owner} style={{ position: 'absolute', left: x, top: y - height }} />
    </>
  );
};
