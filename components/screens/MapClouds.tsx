import { memo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { hash, RAMP, smooth } from './MapTerrain';
import { useLowPower } from '@/lib/quality';

// --- NUBES SOBRE LO DESCONOCIDO (mapa de jefes) ---
// Un banco de nubes opaco tapa lo que aún no conoces (el Soberano y el Castillo) y se
// recoge hacia arriba al desbloquearlo. Se pinta una sola vez en un lienzo con el mismo
// tramado que el terreno: la masa en pizarra con remolinos, el borde de abajo en nubes
// abultadas con un filo claro (la luz del camino les da por debajo) y un par de capas de
// nubes dentro, para que no sea un bloque. Lo único que se mueve es el lienzo entero:
// sube al desbloquear y se mece un poco de lado.

/** Lo que cuelgan las nubes por debajo de su línea (el borde abultado) */
const EDGE = 26;
/** Margen a los lados (para mecerse sin que se vea el corte) */
const SIDE = 10;

/**
 * Borde de nubes en x: panzas redondas (medio círculo, no una onda) de anchos distintos,
 * que cuelgan hacia abajo. Devuelve 0–1 (1 = lo más bajo de una panza).
 */
const billow = (x: number, seed: number, size: number) => {
  // Panzas de ancho variable: se avanza celda a celda con anchos sorteados
  let start = -size * hash(seed, 0, 59);
  let i = 0;
  while (true) {
    const w = size * (0.7 + hash(i, seed, 61) * 0.8);
    if (x < start + w) {
      const f = (x - start) / w;
      const round = Math.sqrt(Math.max(0, 1 - (2 * f - 1) ** 2));
      return round * (0.6 + hash(i, seed, 67) * 0.4);
    }
    start += w; i++;
  }
};

export const MapClouds = memo(({ width, bottom, top, seconds = 0.9 }: {
  width: number;
  /** Lo que tardan en recogerse al desbloquear algo */
  seconds?: number;
  /** Altura de la línea de nubes cuando está todo por descubrir (el lienzo mide eso + EDGE) */
  bottom: number;
  /** Hasta dónde tapan ahora (el lienzo se sube para que su línea quede ahí) */
  top: number;
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const W = width + SIDE * 2;
  const H = Math.max(1, Math.round(bottom + EDGE));
  const lowPower = useLowPower();

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(W, H);
    // Capas de nubes apiladas: cada una con su borde abultado, un filo claro abajo y más
    // oscura hacia arriba hasta la siguiente (la de abajo, la más clara y abultada)
    const ROW = 38;
    const rows = Math.ceil(bottom / ROW) + 1;
    // Cada capa, a su altura (algo desigual) y con panzas de su tamaño
    const rowY = Array.from({ length: rows }, (_, k) => bottom - k * ROW + (k ? (hash(k, 3, 71) - 0.5) * 14 : 0));
    const rowSize = Array.from({ length: rows }, (_, k) => (k === 0 ? 46 : 30 + hash(k, 5, 73) * 26));
    for (let x = 0; x < W; x++) {
      const lines = rowY.map((ry, k) => ry + billow(x, 1 + k, rowSize[k]) * (k === 0 ? EDGE : rowSize[k] * 0.32) - (k === 0 ? EDGE * 0.2 : 0));
      for (let y = 0; y < H; y++) {
        // La capa a la que pertenece este punto: la primera línea que queda por debajo
        let k = -1;
        for (let i = 0; i < rows; i++) if (lines[i] >= y && (k < 0 || lines[i] < lines[k])) k = i;
        if (k < 0) continue;
        const d = lines[k] - y;
        // Más arriba, más oscuro (se funde con la cabecera); la de abajo, la más clara
        const depth = Math.min(1, y / Math.max(1, bottom));
        let L = 0.08 + depth * 0.14 + smooth(x, y, 18, 41) * 0.08;
        // Filo de luz abajo de cada capa, ancho y degradado (da volumen a las panzas)
        const rim = k === 0 ? 13 : 9;
        if (d < rim) L += ((rim - d) / rim) ** 1.6 * (k === 0 ? 0.46 : 0.24 + depth * 0.1);
        else L -= Math.min(0.08, (d - rim) / ROW * 0.08);
        const v = Math.max(0, Math.min(3, Math.floor(L * 4 + (hash(x, y, 47) - 0.5) * 0.6)));
        const c = RAMP[v];
        const j = (y * W + x) * 4;
        img.data[j] = c[0]; img.data[j + 1] = c[1]; img.data[j + 2] = c[2];
        // Opaca; solo las primeras filas del borde de abajo salen punteadas (se deshilacha)
        img.data[j + 3] = k === 0 && d < 2 && hash(x, y, 53) > 0.5 ? 0 : 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [W, H, bottom]);

  return (
    <motion.div className="absolute pointer-events-none" style={{ left: -SIDE, top: 0, width: W, height: H }}
      initial={false} animate={{ y: top - bottom }} transition={{ duration: seconds, ease: 'easeOut' }}>
      <motion.canvas ref={ref} width={W} height={H} className="absolute left-0 top-0"
        style={{ width: W, height: H, imageRendering: 'pixelated' }}
        animate={lowPower ? undefined : { x: [-4, 4] }}
        transition={{ duration: 9, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }} />
    </motion.div>
  );
});
MapClouds.displayName = 'MapClouds';
