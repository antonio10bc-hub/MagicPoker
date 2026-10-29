import { memo, useEffect, useMemo, useRef } from 'react';
import { Sprite, spriteColors, spriteSize, spriteToDataUri } from '@/components/pixel/PixelSprite';
import { SCENERY, SceneryId } from '@/components/pixel/scenery';

// --- TERRENO DEL MAPA DE JEFES ---
// El campo por el que sube el camino, pintado una sola vez en un lienzo del tamaño del
// mapa (1 px interno = 1 px del lienzo). Mismo tramado estocástico que la niebla del
// fondo: cada píxel elige tinta (negro → pizarra → teal → menta → crema) según su
// luminancia más un umbral aleatorio, así no hay degradados limpios.
//  - Campo: casi negro con manchas de pizarra (ruido suave).
//  - Camino: tierra clara con rodadas y arcén más oscuro.
//  - Claros: niebla a ras de suelo alrededor de cada parada.
//  - Agua (estanque, mar) y ciénaga, donde la parada lo pide.
//  - Bosque: pinos y robles en silueta, más densos hacia los bordes, sin pisar el
//    camino ni las paradas. El borde de arriba también cuenta: el bosque se cierra
//    por encima del Castillo y lo rodea, para que se entienda que el mapa acaba ahí.
//  - Viento: algunos árboles, matas y hierba no van en el lienzo sino sueltos encima, y
//    se mecen cuando pasa una racha (solo transformación por CSS: no se repinta nada).

export interface Pt { x: number; y: number }
export interface Biome { kind: 'water' | 'swamp' | 'field'; x: number; y: number; rx: number; ry: number }

export const RAMP: [number, number, number][] = ['#0B0D0C', '#1E2A28', '#5E7A76', '#B9CFC8', '#EDEBE0']
  .map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);

/** Ruido determinista por coordenada */
export const hash = (x: number, y: number, seed: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
};
/** Ruido de valor suave (celdas de `cell` px) */
export const smooth = (x: number, y: number, cell: number, seed: number) => {
  const gx = x / cell, gy = y / cell;
  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const fx = gx - x0, fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, seed), b = hash(x0 + 1, y0, seed), c = hash(x0, y0 + 1, seed), d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
};

const TREES: SceneryId[] = ['pine_s', 'pine_m', 'pine_l', 'pine_m', 'oak', 'bush', 'rock', 'grass'];
/**
 * Alcance del cierre de arriba en px (igual en móvil y PC): bosque espeso hasta la torre
 * del Castillo (~77 px) y más claro hasta media altura de sus muros, que así lo rodea
 */
const TOP_REACH = 480;
/** Cercanía al borde (0 en el borde): los laterales y, arriba, el cierre del mapa */
const edgeOf = (x: number, y: number, W: number) => Math.min(Math.min(x, W - 1 - x) / W, y / TOP_REACH);

/** Dibujo de cada árbol suelto (como fondo CSS, uno por especie) */
const treeUris = new Map<SceneryId, string>();
const treeUri = (id: SceneryId) => {
  let u = treeUris.get(id);
  if (!u) treeUris.set(id, (u = spriteToDataUri(SCENERY[id])));
  return u;
};

/** Lo que puede mecerse: árboles, matas y hierba (sin otro delante que los tape mucho) */
const SWAYS: SceneryId[] = ['pine_s', 'pine_m', 'pine_l', 'oak', 'bush', 'grass'];
/** Las rachas de viento: tres ritmos para que no vayan todos a la vez */
const GUSTS = [7, 9.5, 12];

export const MapTerrain = memo(({ width, height, road, clearings, biomes, keepOut, sway = false }: {
  width: number; height: number;
  /** Puntos seguidos del camino (cada ~1 px) */
  road: Pt[];
  /** Paradas: claro de niebla alrededor */
  clearings: Pt[];
  biomes: Biome[];
  /** Zonas sin árboles (paradas y sus decorados) */
  keepOut: { x: number; y: number; rx: number; ry: number }[];
  /** Algunos árboles sueltos se mecen con el viento (no en bajo consumo) */
  sway?: boolean;
}) => {
  const ref = useRef<HTMLCanvasElement>(null);

  // Dónde va cada árbol (y cuáles se mecen): se calcula una vez y lo usan el lienzo y los sueltos
  const layout = useMemo(() => {
    const W = width, H = height;
    // Distancia al camino (aproximada: se estampa un disco por punto)
    const roadD = new Float32Array(W * H).fill(99);
    const R = 9;
    road.forEach(p => {
      const px = Math.round(p.x), py = Math.round(p.y);
      for (let dy = -R; dy <= R; dy++) {
        const y = py + dy;
        if (y < 0 || y >= H) continue;
        for (let dx = -R; dx <= R; dx++) {
          const x = px + dx;
          if (x < 0 || x >= W) continue;
          const d = Math.hypot(dx, dy);
          const i = y * W + x;
          if (d < roadD[i]) roadD[i] = d;
        }
      }
    });
    const inside = (b: { x: number; y: number; rx: number; ry: number }, x: number, y: number) =>
      ((x - b.x) / b.rx) ** 2 + ((y - b.y) / b.ry) ** 2;

    const spots: { x: number; y: number; id: SceneryId; flip: boolean }[] = [];
    const STEP = 11;
    for (let gy = 0; gy < H; gy += STEP) {
      for (let gx = 0; gx < W; gx += STEP) {
        const x = Math.round(gx + hash(gx, gy, 21) * STEP);
        const y = Math.round(gy + hash(gx, gy, 22) * STEP);
        if (x >= W || y >= H) continue;
        const edge = edgeOf(x, y, W);
        // Más bosque hacia los bordes; en el centro, alguna mata suelta
        const density = edge < 0.16 ? 0.75 : edge < 0.3 ? 0.3 : 0.08;
        if (hash(gx, gy, 23) > density) continue;
        if (roadD[y * W + x] < 13) continue;
        if (keepOut.some(k => inside(k, x, y) < 1)) continue;
        if (biomes.some(b => b.kind !== 'field' && inside(b, x, y) < 1.15)) continue;
        const pick = edge < 0.3 ? TREES[Math.floor(hash(gx, gy, 24) * 5)] : TREES[4 + Math.floor(hash(gx, gy, 25) * 4)];
        spots.push({ x, y, id: pick, flip: hash(gx, gy, 26) > 0.5 });
      }
    }
    spots.sort((a, b) => a.y - b.y);
    // Los que se mecen: fuera del negro de los bordes y sin nadie delante que los tape mucho
    // (son siluetas casi negras: que uno pise un poco al de delante no se nota)
    const swaying = new Set<number>();
    spots.forEach((t, k) => {
      if (!SWAYS.includes(t.id) || edgeOf(t.x, t.y, W) < 0.05 || hash(t.x, t.y, 27) > 0.6) return;
      const { width: sw, height: th } = spriteSize(SCENERY[t.id]);
      for (let j = k + 1; j < spots.length && spots[j].y - t.y < 40; j++) {
        const f = spots[j], fs = spriteSize(SCENERY[f.id]);
        if (Math.abs(f.x - t.x) < (sw + fs.width) / 2 && f.y - fs.height < t.y - th * 0.4) return;
      }
      swaying.add(k);
    });
    return { roadD, spots, swaying };
  }, [width, height, road, keepOut, biomes]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const W = width, H = height;
    const { roadD, spots, swaying } = layout;
    const inside = (b: { x: number; y: number; rx: number; ry: number }, x: number, y: number) =>
      ((x - b.x) / b.rx) ** 2 + ((y - b.y) / b.ry) ** 2;
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        // Campo: oscuro con manchas y alguna mota
        let L = 0.2 + smooth(x, y, 26, 3) * 0.14 + smooth(x, y, 7, 5) * 0.06;
        // Bordes del mapa más negros (bosque cerrado)
        const edge = edgeOf(x, y, W);
        if (edge < 0.14) L -= (0.14 - edge) * 1.2;
        // Claros de niebla en las paradas
        clearings.forEach(c => {
          if (Math.abs(y - c.y) > 76) return;
          const k = inside({ ...c, rx: 100, ry: 66 }, x, y + 12);
          if (k < 1) L += (1 - k) * (1 - k) * 0.42;
        });
        // Agua, ciénaga, huerto
        biomes.forEach(b => {
          const k = inside(b, x, y);
          if (k >= 1) return;
          if (b.kind === 'water') {
            // Olas: rayas horizontales que se cortan
            const wave = (Math.sin(x * 0.45 + y * 1.7) + smooth(x, y, 5, 9)) > 1.05 ? 0.22 : 0;
            L = 0.3 + wave + (1 - k) * 0.06 - (k > 0.85 ? 0.1 : 0);
          } else if (b.kind === 'swamp') {
            L = 0.12 + (smooth(x, y, 6, 11) > 0.6 ? 0.18 : 0);
          } else {
            // Surcos
            L += (y % 3 === 0 ? 0.12 : -0.03) * (1 - k);
          }
        });
        // Camino: tierra clara con rodadas; arcén oscuro
        const d = roadD[i];
        if (d < 4) L = Math.max(L, 0.36) + (Math.abs(d - 2) < 0.6 ? -0.1 : 0.04) + smooth(x, y, 3, 7) * 0.06;
        else if (d < 5.5) L = Math.min(L, 0.1);
        const v = Math.max(0, Math.min(4, Math.floor(L * 4 + (hash(x, y, 1) - 0.5) * 0.9)));
        const c = RAMP[v];
        img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
      }
    }

    // Árboles y matas en silueta, ordenados por altura (los de abajo tapan a los de arriba)
    const colors = spriteColors('player');
    const stamp = (sprite: Sprite, left: number, top: number, flip: boolean) => {
      const { width: sw } = spriteSize(sprite);
      sprite.rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          const ch = row[flip ? sw - 1 - rx : rx];
          if (!ch || ch === '.' || !colors[ch]) continue;
          const x = left + rx, y = top + ry;
          if (x < 0 || x >= W || y < 0 || y >= H) continue;
          const hex = colors[ch];
          const j = (y * W + x) * 4;
          img.data[j] = parseInt(hex.slice(1, 3), 16); img.data[j + 1] = parseInt(hex.slice(3, 5), 16); img.data[j + 2] = parseInt(hex.slice(5, 7), 16);
        }
      });
    };
    spots.forEach((t, k) => {
      if (sway && swaying.has(k)) return;
      const sprite = SCENERY[t.id];
      const { width: sw, height: sh } = spriteSize(sprite);
      stamp(sprite, t.x - Math.floor(sw / 2), t.y - sh, t.flip);
    });
    ctx.putImageData(img, 0, 0);
  }, [width, height, clearings, biomes, layout, sway]);

  return (
    <>
      <canvas ref={ref} width={width} height={height} className="absolute left-0 top-0 pointer-events-none"
        style={{ width, height, imageRendering: 'pixelated' }} />
      {/* Los que se mecen: el viento pasa en rachas de izquierda a derecha, por tandas */}
      {sway && layout.spots.map((t, k) => {
        if (!layout.swaying.has(k)) return null;
        const { width: sw, height: sh } = spriteSize(SCENERY[t.id]);
        const gust = GUSTS[Math.floor(hash(t.x, t.y, 28) * GUSTS.length)];
        return (
          <span key={k} className="absolute pointer-events-none anim-tree"
            style={{ left: t.x - Math.floor(sw / 2), top: t.y - sh, width: sw, height: sh, backgroundImage: treeUri(t.id),
              ['--flip' as string]: t.flip ? -1 : 1, imageRendering: 'pixelated',
              animationDuration: `${gust}s`, animationDelay: `${(t.x / width) * 1.4 + Math.floor(t.y / 400) * 2.3}s` }} />
        );
      })}
    </>
  );
});
MapTerrain.displayName = 'MapTerrain';
