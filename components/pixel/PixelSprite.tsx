import { CSSProperties, memo, useMemo } from 'react';
import { INK, PALETTE, TEAM } from '@/theme/tokens';
import { Owner } from '@/types';

// --- SPRITES DE PÍXELES ---
// Un sprite es una cuadrícula de caracteres; cada carácter es un color de la paleta.
// Se dibuja como SVG con `shape-rendering: crispEdges`, así que escala por enteros sin
// suavizado. '.' es transparente. Un solo trazado por color (no un rectángulo por
// tramo): el mapa pasaba de 7000 nodos SVG y eso pesa en móviles.

export interface Sprite {
  rows: string[];
}

/** Mapa carácter → color. t/T/u se resuelven con el color del bando. */
const BASE_COLORS: Record<string, string> = {
  o: PALETTE.outline,
  d: PALETTE.stoneDark,
  g: PALETTE.floor,
  l: PALETTE.floorPattern,
  p: PALETTE.pavement,
  w: PALETTE.white,
  b: PALETTE.glass,
  c: PALETTE.cyan,
  n: PALETTE.navy,
  a: PALETTE.roof,
  x: PALETTE.red,
  X: PALETTE.redDark,
  e: PALETTE.green,
  y: PALETTE.yellow,
  Y: PALETTE.yellowDark,
  m: PALETTE.wood,
  M: PALETTE.woodDark,
  s: PALETTE.skin,
  S: PALETTE.skinShade,
  k: INK.gold,
};

export const spriteColors = (owner: Owner = 'player'): Record<string, string> => ({
  ...BASE_COLORS,
  t: TEAM[owner].base,
  T: TEAM[owner].light,
  u: TEAM[owner].dark,
});

const PLAYER_COLORS = spriteColors('player');
const OPPONENT_COLORS = spriteColors('opponent');

export const spriteSize = (sprite: Sprite) => ({
  width: Math.max(...sprite.rows.map(r => r.length)),
  height: sprite.rows.length,
});

/** Agrupa píxeles contiguos del mismo color en rectángulos horizontales */
const toRects = (sprite: Sprite, colors: Record<string, string>) => {
  const rects: { x: number; y: number; w: number; fill: string }[] = [];
  sprite.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let w = 1;
      while (row[x + w] === ch) w++;
      if (ch !== '.' && ch !== ' ' && colors[ch]) rects.push({ x, y, w, fill: colors[ch] });
      x += w;
    }
  });
  return rects;
};

/** SVG como texto (para usarlo de fondo en CSS: patrones de suelo, dorsos...) */
export const spriteToDataUri = (sprite: Sprite, owner: Owner = 'player'): string => {
  const { width, height } = spriteSize(sprite);
  const body = toRects(sprite, spriteColors(owner))
    .map(r => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.fill}"/>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" shape-rendering="crispEdges">${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

interface PixelSpriteProps {
  sprite: Sprite;
  owner?: Owner;
  /** Factor entero de escala sobre la resolución interna */
  scale?: number;
  /** Silueta plana: todos los píxeles opacos de este color (sin detalle interno) */
  tint?: string;
  className?: string;
  style?: CSSProperties;
}

/** Los tramos de cada color, juntos en un trazado (tramo = M x y, h ancho, v 1, h -ancho) */
const toPaths = (sprite: Sprite, colors: Record<string, string>) => {
  const byFill = new Map<string, string>();
  toRects(sprite, colors).forEach(r => byFill.set(r.fill, `${byFill.get(r.fill) ?? ''}M${r.x} ${r.y}h${r.w}v1h-${r.w}z`));
  return [...byFill].map(([fill, d]) => ({ fill, d }));
};

const PixelSpriteComponent = ({ sprite, owner = 'player', scale = 1, tint, className, style }: PixelSpriteProps) => {
  const { width, height } = spriteSize(sprite);
  const paths = useMemo(() => {
    const colors = owner === 'player' ? PLAYER_COLORS : OPPONENT_COLORS;
    return toPaths(sprite, tint ? Object.fromEntries(Object.keys(colors).map(k => [k, tint])) : colors);
  }, [sprite, owner, tint]);
  return (
    <svg
      width={width * scale}
      height={height * scale}
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      className={className}
      style={{ display: 'block', ...style }}
      aria-hidden
    >
      {paths.map(p => <path key={p.fill} d={p.d} fill={p.fill} />)}
    </svg>
  );
};

export const PixelSprite = memo(PixelSpriteComponent);
