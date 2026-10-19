import { CSSProperties, ReactNode } from 'react';
import { clsx } from 'clsx';
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
 * Plataforma-diorama: plano inclinado de grano frío, sin contornos. Proyecta una sombra
 * larga y granulada abajo-derecha y la niebla crema le envuelve la base.
 */
export const Platform = ({ rect, rim = 4, faceHeight = 14, floor, floorTile = 16, rimColor, faceTexture }: {
  rect: Rect; rim?: number; faceHeight?: number; floor: string; floorTile?: number; rimColor: string; faceTexture: string;
}) => {
  const top: Rect = { x: rect.x, y: rect.y, w: rect.w, h: rect.h - faceHeight };
  return (
    <>
      {/* Sombra proyectada larga (contraluz desde arriba-izquierda) */}
      <div style={{
        ...box({ x: rect.x + 10, y: rect.y + 16, w: rect.w, h: rect.h }),
        background: 'linear-gradient(160deg, rgba(11,13,12,0.85) 30%, rgba(11,13,12,0) 100%)', filter: 'blur(3px)',
      }} />
      {/* Cara frontal en sombra */}
      <Surface rect={{ x: rect.x, y: top.y + top.h, w: rect.w, h: faceHeight }} texture={faceTexture} tileSize={12} />
      {/* Cara superior: borde teal granulado */}
      <Surface rect={top} texture={rimColor} tileSize={16} style={{ filter: 'blur(0.35px)' }} />
      {/* Suelo jugable, un punto más oscuro que el borde */}
      <Surface
        rect={{ x: top.x + rim, y: top.y + rim, w: top.w - rim * 2, h: top.h - rim * 2 }}
        texture={floor}
        tileSize={floorTile}
        // Los puntos se funden un poco, como tinta absorbida por el papel
        style={{ boxShadow: 'inset 0 2px 4px rgba(11,13,12,0.6)', filter: 'blur(0.35px)' }}
      />
      {/* Niebla a ras de suelo que envuelve la base del diorama */}
      <div className="pointer-events-none" style={{
        ...box({ x: rect.x - 24, y: top.y + top.h - 10, w: rect.w + 48, h: faceHeight + 34 }),
        background: 'radial-gradient(ellipse 50% 50% at 50% 45%, rgba(237,235,224,0.55) 0%, rgba(185,207,200,0.3) 45%, rgba(111,143,90,0.08) 70%, transparent 80%)',
        filter: 'blur(2px)',
      }} />
    </>
  );
};

/** Banda de niebla a ras de suelo (base de una fila de cartas, franja central...) */
export const Fog = ({ rect, strength = 0.45 }: { rect: Rect; strength?: number }) => (
  <div className="pointer-events-none" style={{
    ...box(rect),
    background: `radial-gradient(ellipse 50% 50% at 50% 50%, rgba(237,235,224,${strength}) 0%, rgba(185,207,200,${strength * 0.5}) 50%, transparent 100%)`,
    filter: 'blur(1.5px)',
  }} />
);

/** Franja central: línea de niebla granulada */
export const Strip = ({ rect, texture, tileSize = 8 }: { rect: Rect; texture: string; tileSize?: number }) => (
  <Surface rect={rect} texture={texture} tileSize={tileSize} style={{ opacity: 0.55, filter: 'blur(0.4px)' }} />
);

/** Barandilla: silueta oscura recortada contra la niebla */
export const Railing = ({ x, y, w, h = 13 }: { x: number; y: number; w: number; h?: number }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: h }}>
    {/* Resplandor de niebla detrás de los balaustres */}
    <div style={{
      position: 'absolute', left: 0, right: 0, top: 1, bottom: 0,
      background: 'linear-gradient(to bottom, rgba(185,207,200,0.15), rgba(237,235,224,0.4))',
    }} />
    {/* Balaustres */}
    <div style={{
      position: 'absolute', left: 0, right: 0, top: 3, bottom: 2,
      backgroundImage: 'repeating-linear-gradient(90deg, var(--ink-black) 0 2px, transparent 2px 6px)',
    }} />
    {/* Pasamanos y zócalo */}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3, background: 'var(--ink-black)' }} />
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: 'var(--ink-black)' }} />
  </div>
);

/**
 * Objeto del entorno con su sombra elíptica a los pies. (x, y) = base del objeto.
 * Si el tablero está inclinado en 3D (variable CSS --tilt), el objeto se "pone de pie"
 * girando en sentido contrario sobre su base: así farolas y banderolas no se tumban.
 */
export const Prop = ({ sprite, x, y, owner, shadow = true, sway, glow, tint, bloom }: {
  sprite: Sprite; x: number; y: number; owner?: Owner; shadow?: boolean;
  /** Ondea con el viento (banderolas) */
  sway?: boolean;
  /** Halo de luz centrado en este punto relativo al sprite (farolas) */
  glow?: { x: number; y: number; color: string };
  /** Silueta plana de un solo color */
  tint?: string;
  /** Brilla desde dentro (masas naranjas) */
  bloom?: boolean;
}) => {
  const { width, height } = spriteSize(sprite);
  return (
    <>
      {shadow && (
        // Sombra larga y difusa, alejándose de la luz
        <div style={{
          position: 'absolute', left: x + 2, top: y - 2, width: width + 14, height: 4,
          background: 'rgba(11,13,12,0.75)', borderRadius: '50%', filter: 'blur(1px)', transform: 'skewX(-40deg)',
        }} />
      )}
      <div style={{
        position: 'absolute', left: x, top: y - height, width, height,
        transform: 'rotateX(calc(-1 * var(--tilt, 0deg)))', transformOrigin: '50% 100%',
      }}>
        {glow && (
          <div className="anim-lamp" style={{
            position: 'absolute', left: glow.x - 18, top: glow.y - 18, width: 36, height: 36, borderRadius: '50%',
            background: `radial-gradient(circle, ${glow.color} 0%, rgba(242,101,42,0.25) 35%, transparent 70%)`, pointerEvents: 'none',
            filter: 'blur(1px)',
          }} />
        )}
        <div className={clsx(sway && 'anim-banner', bloom && 'bloom')} style={{ animationDelay: `${(x % 7) * -0.3}s` }}>
          <PixelSprite sprite={sprite} owner={owner} tint={tint} />
        </div>
      </div>
    </>
  );
};
