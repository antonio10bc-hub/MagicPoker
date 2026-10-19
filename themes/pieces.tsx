import { CSSProperties, ReactNode } from 'react';
import { Rect } from './types';

// --- PIEZAS MODULARES DE ESCENARIO ---
// Cada escenario se compone con estas piezas en capas:
// sombra → canto → superficie → luces → cartas → interfaz.
// Rendimiento: nada de `filter` en superficies grandes (el tablero se inclina en 3D y
// se repintaría); la suavidad sale de los degradados y del grano global.

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
 * Tapete: plano de grano con canto y una sombra larga y blanda abajo-derecha.
 * `face` es la textura del canto; `surface`, la del tapete.
 */
export const Mat = ({ rect, faceHeight, surface, face, radius = 6 }: {
  rect: Rect; faceHeight: number; surface: string; face: string; radius?: number;
}) => {
  const top: Rect = { x: rect.x, y: rect.y, w: rect.w, h: rect.h - faceHeight };
  return (
    <>
      {/* Sombra proyectada larga (contraluz desde arriba-izquierda) */}
      <div style={{
        ...box({ x: rect.x + 8, y: rect.y + 12, w: rect.w, h: rect.h }), borderRadius: radius + 4,
        background: 'radial-gradient(ellipse 60% 60% at 45% 45%, rgba(11,13,12,0.9) 40%, rgba(11,13,12,0) 100%)',
      }} />
      {/* Canto */}
      <Surface rect={{ x: rect.x, y: top.y + top.h - radius, w: rect.w, h: faceHeight + radius }} texture={face} tileSize={12}
        style={{ borderRadius: `0 0 ${radius}px ${radius}px` }} />
      {/* Superficie, con el borde un poco hundido en sombra */}
      <Surface rect={top} texture={surface} tileSize={16} style={{
        borderRadius: radius,
        boxShadow: 'inset 0 0 18px 2px rgba(11,13,12,0.75), inset 0 1px 0 rgba(185,207,200,0.12)',
      }} />
    </>
  );
};

/** Luz suave sobre una zona (degradado radial; el grano global lo convierte en puntos) */
export const Glow = ({ rect, background, radius = 0 }: { rect: Rect; background: string; radius?: number }) => (
  <div className="pointer-events-none" style={{ ...box(rect), background, borderRadius: radius }} />
);
