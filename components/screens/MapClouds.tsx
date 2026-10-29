import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { hash, RAMP, smooth } from './MapTerrain';
import { useLowPower } from '@/lib/quality';

// --- NUBES SOBRE LO DESCONOCIDO (mapa de jefes) ---
// Un banco de nubes opaco tapa lo que aún no conoces (el Soberano y el Castillo). Son
// cúmulos sueltos (no filas: en filas parecían olas), de tamaños distintos y colocados a
// suertes, unos sobre otros: los de atrás más oscuros, los de delante con un filo de luz
// abajo (la del camino les da por debajo). Los más grandes, abajo, hacen el borde.
// Se pintan una sola vez en un lienzo con el mismo tramado que el terreno.
//  - Al descubrir algo, el banco sube con un pequeño rebote y del borde se desprenden
//    jirones que se van flotando y se deshacen.
//  - Al irse del todo (el Castillo se alza), el banco se parte por el medio con un corte
//    irregular: cada mitad se va a su lado subiendo y apagándose, entre muchos jirones.

/** Lo que cuelgan los cúmulos de abajo por debajo de la línea de las nubes */
const EDGE = 28;
/** Margen a los lados (para mecerse y partirse sin que se vea el corte del lienzo) */
const SIDE = 12;

interface Puff { x: number; y: number; r: number; depth: number }

/** Cúmulos: los del borde, grandes y seguidos; por encima, sueltos y cada vez más al fondo */
const puffsFor = (W: number, bottom: number): Puff[] => {
  const out: Puff[] = [];
  // El borde: una fila apretada de cúmulos grandes (unos más bajos que otros)
  let x = -10;
  for (let i = 0; x < W + 20; i++) {
    const r = 20 + hash(i, 1, 81) * 16;
    out.push({ x, y: bottom - r * 0.35 + hash(i, 2, 83) * 10, r, depth: 1 });
    x += r * (1.05 + hash(i, 3, 85) * 0.5);
  }
  // Arriba: cúmulos sueltos por toda la masa, más pequeños y oscuros cuanto más arriba
  const n = Math.round((W * bottom) / 900);
  for (let i = 0; i < n; i++) {
    const y = bottom - 30 - hash(i, 5, 87) * (bottom - 20);
    const up = 1 - y / Math.max(1, bottom);
    out.push({ x: hash(i, 7, 89) * W, y, r: 10 + hash(i, 9, 91) * 22 * (1 - up * 0.4), depth: 0.85 - up * 0.45 });
  }
  // Se pintan de atrás adelante: los de arriba (fondo) primero
  return out.sort((a, b) => a.depth - b.depth || a.y - b.y);
};

/** Pinta el banco en un lienzo */
const paintClouds = (ctx: CanvasRenderingContext2D, W: number, H: number, bottom: number) => {
  const L = new Float32Array(W * H).fill(-1);
  // Fondo de la masa (entre cúmulos): muy oscuro, con algún remolino
  for (let y = 0; y < Math.min(H, bottom); y++) {
    for (let x = 0; x < W; x++) L[y * W + x] = 0.06 + (y / Math.max(1, bottom)) * 0.08 + smooth(x, y, 24, 41) * 0.06;
  }
  puffsFor(W, bottom).forEach((p, idx) => {
    const r2 = p.r * p.r;
    for (let y = Math.max(0, Math.floor(p.y - p.r)); y < Math.min(H, Math.ceil(p.y + p.r)); y++) {
      for (let x = Math.max(0, Math.floor(p.x - p.r)); x < Math.min(W, Math.ceil(p.x + p.r)); x++) {
        const dx = x - p.x, dy = y - p.y;
        const q = dx * dx + dy * dy;
        if (q > r2) continue;
        const dist = Math.sqrt(q);
        // Cuerpo: más claro abajo (le da la luz de abajo), más oscuro arriba
        let l = 0.1 + p.depth * 0.14 + (dy / p.r) * 0.05 * p.depth + smooth(x + idx * 7, y, 9, 43) * 0.05;
        // Filo de luz en la mitad de abajo del contorno
        const rim = p.r - dist;
        if (dy > -p.r * 0.2 && rim < 4) l += ((4 - rim) / 4) * (0.12 + p.depth * 0.3);
        // Sombra fina en la mitad de arriba del contorno (separa unos de otros)
        else if (dy < 0 && rim < 1.5) l -= 0.08;
        L[y * W + x] = l;
      }
    }
  });
  const img = ctx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    if (L[i] < 0) continue;
    const x = i % W, y = (i / W) | 0;
    const v = Math.max(0, Math.min(3, Math.floor(L[i] * 4 + (hash(x, y, 47) - 0.5) * 0.6)));
    const c = RAMP[v];
    img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
};

/** Corte irregular de arriba abajo (para partir el banco en dos) */
const zigzag = (W: number, H: number, side: 'left' | 'right') => {
  const cx = W / 2;
  const pts: string[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const y = (H * i) / steps;
    pts.push(`${cx + (hash(i, 11, 93) - 0.5) * 36}px ${y}px`);
  }
  return side === 'left'
    ? `polygon(0 0, ${pts.join(', ')}, 0 ${H}px)`
    : `polygon(${W}px 0, ${pts.join(', ')}, ${W}px ${H}px)`;
};

/** Jirón: un cúmulo pequeño que se desprende del borde, se va flotando y se deshace */
const Wisp = ({ x, y, r, dx, dy, delay, seconds }: { x: number; y: number; r: number; dx: number; dy: number; delay: number; seconds: number }) => (
  <motion.span className="absolute pointer-events-none rounded-full"
    style={{ left: x - r, top: y - r, width: r * 2, height: r * 2,
      background: 'radial-gradient(circle at 50% 62%, #5E7A76 0 34%, #1E2A28 35% 68%, transparent 69%)' }}
    initial={{ x: 0, y: 0, scale: 0.7, opacity: 0 }}
    animate={{ x: dx, y: dy, scale: [0.7, 1.15, 1.5], opacity: [0, 1, 0] }}
    transition={{ duration: seconds, delay, ease: 'easeOut', times: [0, 0.25, 1] }} />
);

export const MapClouds = memo(({ width, bottom, top, seconds = 0.9 }: {
  width: number;
  /** Altura de la línea de nubes con todo por descubrir (el lienzo mide eso + EDGE) */
  bottom: number;
  /** Hasta dónde tapan ahora (por debajo de 0: se han ido del todo) */
  top: number;
  /** Lo que tardan en recogerse al descubrir algo */
  seconds?: number;
}) => {
  const left = useRef<HTMLCanvasElement>(null);
  const right = useRef<HTMLCanvasElement>(null);
  const W = width + SIDE * 2;
  const H = Math.max(1, Math.round(bottom + EDGE));
  const lowPower = useLowPower();
  const gone = top < 0;

  useEffect(() => {
    const a = left.current?.getContext('2d');
    const b = right.current?.getContext('2d');
    if (!a || !b) return;
    paintClouds(a, W, H, bottom);
    b.drawImage(left.current!, 0, 0);
  }, [W, H, bottom]);

  // Al recogerse, jirones donde estaba el borde (se lanzan cada vez que sube)
  const last = useRef(top);
  const [burst, setBurst] = useState<{ id: number; at: number; full: boolean } | null>(null);
  useEffect(() => {
    if (top < last.current) {
      const id = Date.now();
      setBurst({ id, at: last.current, full: top < 0 });
      const t = setTimeout(() => setBurst(b => (b?.id === id ? null : b)), ((top < 0 ? seconds : 1.6) + 1.2) * 1000);
      last.current = top;
      return () => clearTimeout(t);
    }
    last.current = top;
  }, [top, seconds]);
  const wisps = useMemo(() => {
    if (!burst) return [];
    const n = burst.full ? 26 : 14;
    return Array.from({ length: n }, (_, i) => {
      const x = SIDE + (width * (i + 0.5)) / n + (hash(i, 13, 95) - 0.5) * 18;
      const out = x < W / 2 ? -1 : 1;
      return {
        x, y: (burst.full ? hash(i, 15, 97) * burst.at : burst.at) + EDGE * 0.3, r: 7 + hash(i, 17, 99) * 9,
        dx: out * (20 + hash(i, 19, 101) * 50), dy: -(16 + hash(i, 21, 103) * (burst.full ? 80 : 40)),
        delay: hash(i, 23, 105) * 0.5,
      };
    });
  }, [burst, width, W]);

  const halfMove = (side: 'left' | 'right') => (gone
    ? { x: (side === 'left' ? -1 : 1) * W * 0.7, y: top - bottom - 40, opacity: 0, rotate: side === 'left' ? -4 : 4 }
    : { x: 0, y: top - bottom, opacity: 1, rotate: 0 });
  // Subir con un pequeño rebote; al irse, con calma
  const lift = gone ? { duration: seconds, ease: 'easeIn' as const } : { type: 'spring' as const, stiffness: 60, damping: 11, mass: Math.max(1, seconds) };

  return (
    <div className="absolute pointer-events-none" style={{ left: -SIDE, top: 0, width: W, height: H }}>
      <motion.div className="absolute inset-0" animate={lowPower || gone ? undefined : { x: [-4, 4] }}
        transition={{ duration: 9, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}>
        {(['left', 'right'] as const).map(side => (
          <motion.div key={side} className="absolute inset-0" style={{ clipPath: zigzag(W, H, side), transformOrigin: side === 'left' ? '0% 100%' : '100% 100%' }}
            initial={false} animate={halfMove(side)} transition={lift}>
            <canvas ref={side === 'left' ? left : right} width={W} height={H} className="absolute left-0 top-0"
              style={{ width: W, height: H, imageRendering: 'pixelated' }} />
          </motion.div>
        ))}
      </motion.div>
      <AnimatePresence>
        {burst && (
          <motion.div key={burst.id} className="absolute inset-0" exit={{ opacity: 0 }}>
            {wisps.map((w, i) => <Wisp key={i} {...w} seconds={burst.full ? seconds : 1.6} />)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
MapClouds.displayName = 'MapClouds';
