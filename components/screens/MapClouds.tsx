import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { hash, RAMP, smooth } from './MapTerrain';
import { useLowPower } from '@/lib/quality';

// --- NUBES SOBRE LO DESCONOCIDO (mapa de jefes) ---
// Un banco de nubes opaco tapa lo que aún no conoces (el Soberano y el Castillo). Son
// cúmulos (una bola grande con hombros y cabezas encima) repartidos a suertes, unos
// delante de otros: los del fondo más pequeños y oscuros, los de delante con un filo de
// luz abajo (la del camino les da por debajo). Una fila de cúmulos grandes hace el borde.
// Se pintan una sola vez, con el mismo tramado que el terreno, en dos lienzos: cada uno
// con la mitad de los cúmulos (los de la izquierda y los de la derecha, sin corte recto).
//  - Al descubrir algo, el banco sube con un pequeño rebote y del borde se desprenden
//    jirones (cúmulos pequeños) que se van flotando y se deshacen.
//  - Al irse del todo (el Castillo se alza), el banco se abre por el medio siguiendo el
//    contorno de las nubes: un tirón corto y cada mitad se va a su lado subiendo y
//    apagándose, entre muchos jirones.

/** Lo que cuelgan los cúmulos de abajo por debajo de la línea de las nubes */
const EDGE = 28;
/** Margen a los lados (para mecerse y partirse sin que se vea el corte del lienzo) */
const SIDE = 12;

interface Puff { x: number; y: number; r: number }
/** Un cúmulo: una bola grande con dos hombros a los lados y cabezas encima */
interface Cloud { x: number; y: number; R: number; depth: number; puffs: Puff[] }

const cloudAt = (x: number, y: number, R: number, depth: number, k: number): Cloud => {
  const j = (n: number) => hash(k, n, 111) - 0.5;
  const puffs: Puff[] = [
    { x, y, r: R },
    { x: x - R * (0.85 + j(1) * 0.3), y: y + R * 0.25, r: R * (0.62 + j(2) * 0.2) },
    { x: x + R * (0.85 + j(3) * 0.3), y: y + R * 0.25, r: R * (0.62 + j(4) * 0.2) },
    { x: x - R * (0.35 + j(5) * 0.2), y: y - R * (0.45 + j(6) * 0.2), r: R * (0.55 + j(7) * 0.2) },
    { x: x + R * (0.3 + j(8) * 0.2), y: y - R * (0.55 + j(9) * 0.2), r: R * (0.5 + j(10) * 0.2) },
  ];
  return { x, y, R, depth, puffs };
};

/** Cúmulos a suertes por toda la masa (unos tapan a otros), y una fila de grandes en el borde */
const cloudsFor = (W: number, bottom: number): Cloud[] => {
  const out: Cloud[] = [];
  // La masa: rejilla con mucho azar; arriba, más pequeños y más al fondo
  const cell = 46;
  let k = 0;
  for (let gy = 0; gy * cell * 0.6 < bottom + 20; gy++) {
    for (let gx = -1; gx * cell < W + cell; gx++, k++) {
      const y = bottom - 30 - gy * cell * 0.6 + (hash(gx, gy, 95) - 0.5) * cell * 0.5;
      const up = Math.max(0, Math.min(1, 1 - y / Math.max(1, bottom)));
      const R = (14 + hash(gx, gy, 97) * 16) * (1 - up * 0.3);
      out.push(cloudAt(gx * cell + (gy % 2) * cell * 0.5 + (hash(gx, gy, 99) - 0.5) * cell * 0.6, y, R, 0.85 - up * 0.6, k));
    }
  }
  // El borde: cúmulos grandes y seguidos, delante de todo
  let x = -10;
  for (let i = 0; x < W + 30; i++, k++) {
    const R = 20 + hash(i, 1, 81) * 12;
    out.push(cloudAt(x, bottom - R * 0.55 + hash(i, 2, 83) * 8, R, 1, k));
    x += R * (1.25 + hash(i, 3, 85) * 0.4);
  }
  // Se pintan de atrás adelante: los del fondo primero y, a igual fondo, los de arriba
  return out.sort((a, b) => a.depth - b.depth || a.y - b.y);
};

/** Cada mitad del banco: los cúmulos de su lado (la raya del medio, a suertes) */
const halfOf = (clouds: Cloud[], W: number, side: 'left' | 'right') =>
  clouds.filter((c, k) => (c.x + (hash(k, 7, 113) - 0.5) * 44 < W / 2) === (side === 'left'));

/** Pinta unos cúmulos en un lienzo. Debajo de cada uno, un halo de tono medio rellena
 * los huecos con los vecinos (así no asoma nada entre nubes ni hay bordes rectos) */
const paintClouds = (ctx: CanvasRenderingContext2D, W: number, H: number, clouds: Cloud[], halo = 7) => {
  const L = new Float32Array(W * H).fill(-1);
  clouds.forEach((c, idx) => {
    const top = c.y - c.R * 1.3 - halo, low = c.y + c.R + halo;
    for (let y = Math.max(0, Math.floor(top)); y < Math.min(H, Math.ceil(low)); y++) {
      for (let x = Math.max(0, Math.floor(c.x - c.R * 2 - halo)); x < Math.min(W, Math.ceil(c.x + c.R * 2 + halo)); x++) {
        // Hondura dentro del cúmulo (lo que falta para el borde de la bola más cercana a salir)
        let inside = -halo - 1;
        for (const p of c.puffs) inside = Math.max(inside, p.r - Math.hypot(x - p.x, y - p.y));
        const i = y * W + x;
        if (inside <= 0) {
          // Halo: solo donde no hay ya nada
          if (inside > -halo && L[i] < 0) L[i] = 0.26 + smooth(x, y, 24, 41) * 0.06;
          continue;
        }
        // Luz de abajo (el camino): más claro abajo, más oscuro arriba; grumos suaves
        const ny = (y - c.y) / (c.R * 1.2);
        let l = 0.3 + c.depth * 0.2 + ny * 0.14 * (0.5 + c.depth) + smooth(x + idx * 13, y, 6, 43) * 0.08;
        // Filo de luz por abajo, más ancho en los de delante; arriba, una sombra fina que lo despega
        const rw = 2 + c.depth * 2.5;
        if (ny > -0.15 && inside < rw) l += ((rw - inside) / rw) * (0.1 + c.depth * 0.25);
        else if (ny < -0.3 && inside < 2) l -= 0.12;
        L[i] = l;
      }
    }
  });
  const img = ctx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    if (L[i] < 0) continue;
    const x = i % W, y = (i / W) | 0;
    const v = Math.max(0, Math.min(3, Math.floor(L[i] * 4 + (hash(x, y, 47) - 0.5) * 0.7)));
    const c = RAMP[v];
    img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
};

/** Jirones: tres cúmulos pequeños pintados igual que el banco (imágenes que se reutilizan) */
const WISP_R = [5, 7, 9];
const paintWisps = () => WISP_R.map((R, k) => {
  const w = Math.ceil(R * 4.4), h = Math.ceil(R * 2.6);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  paintClouds(cv.getContext('2d')!, w, h, [cloudAt(w / 2, h - R - 1, R, 0.9, 300 + k)], 0);
  return { src: cv.toDataURL(), w, h };
});

let wispCache: ReturnType<typeof paintWisps> | null = null;
const wispSprites = () => (wispCache ??= paintWisps());
const noSubscribe = () => () => {};

/** Jirones de reposo: dónde salen (fracción del ancho, px bajo el borde), cuánto se mueven y su ritmo */
const IDLE_WISPS = [
  { x: 0.18, y: 4, dx: 26, s: 0, t: 7, delay: 0.5, rest: 4 },
  { x: 0.62, y: 9, dx: -22, s: 1, t: 8.5, delay: 3, rest: 5 },
  { x: 0.4, y: 2, dx: 18, s: 0, t: 6.5, delay: 6, rest: 6 },
  { x: 0.85, y: 6, dx: -24, s: 2, t: 9, delay: 8, rest: 3.5 },
];

/** Jirón: un cúmulo pequeño que se desprende del borde, se va flotando y se deshace */
const Wisp = ({ x, y, dx, dy, delay, seconds, sprite }: {
  x: number; y: number; dx: number; dy: number; delay: number; seconds: number; sprite: { src: string; w: number; h: number };
}) => (
  <motion.img src={sprite.src} alt="" className="absolute pointer-events-none"
    style={{ left: x - sprite.w / 2, top: y - sprite.h / 2, width: sprite.w, height: sprite.h, imageRendering: 'pixelated' }}
    initial={{ x: 0, y: 0, scale: 0.6, opacity: 0 }}
    animate={{ x: dx, y: dy, scale: [0.6, 1.1, 1.35], opacity: [0, 1, 0] }}
    transition={{ duration: seconds, delay, ease: 'easeOut', times: [0, 0.2, 1] }} />
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
    const clouds = cloudsFor(W, bottom);
    const a = left.current?.getContext('2d');
    const b = right.current?.getContext('2d');
    if (!a || !b) return;
    paintClouds(a, W, H, halfOf(clouds, W, 'left'));
    paintClouds(b, W, H, halfOf(clouds, W, 'right'));
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
    const sprites = wispSprites();
    const n = (burst.full ? 30 : 14) / (lowPower ? 2 : 1);
    return Array.from({ length: n }, (_, i) => {
      const x = SIDE + (width * (i + 0.5)) / n + (hash(i, 13, 95) - 0.5) * 18;
      const out = x < W / 2 ? -1 : 1;
      // Al irse del todo salen de toda la masa (más hacia el medio, por donde se abre)
      const y = burst.full ? hash(i, 15, 97) * burst.at : burst.at;
      return {
        x, y: y + EDGE * 0.3, sprite: sprites[Math.floor(hash(i, 17, 99) * sprites.length)],
        dx: out * (burst.full ? 40 + hash(i, 19, 101) * 90 : 14 + hash(i, 19, 101) * 40),
        dy: -(16 + hash(i, 21, 103) * (burst.full ? 90 : 36)),
        delay: (burst.full ? 0.15 : 0) + hash(i, 23, 105) * 0.5,
      };
    });
  }, [burst, width, W, lowPower]);

  // Irse: un tirón corto (se abre la raya) y cada mitad a su lado, subiendo y apagándose
  const from = (burst?.full ? burst.at : 0) - bottom;
  // Reposo (no en bajo consumo ni mientras se van)
  const idle = !lowPower && !gone;
  // Los jirones se pintan en el navegador (en el servidor no hay lienzo)
  const idleSprites = useSyncExternalStore(noSubscribe, wispSprites, () => null);

  const halfMove = (side: 'left' | 'right') => {
    const dir = side === 'left' ? -1 : 1;
    return gone
      ? { x: [0, dir * 7, dir * W * 0.8], y: [from, from + 3, from - bottom * 0.35], rotate: [0, 0, dir * 6], opacity: [1, 1, 0] }
      : { x: 0, y: top - bottom, rotate: 0, opacity: 1 };
  };
  // Subir con un pequeño rebote; al irse, con calma (la derecha un pelo después)
  const lift = (side: 'left' | 'right') => gone
    ? { duration: seconds, ease: 'easeIn' as const, times: [0, 0.16, 1], delay: side === 'right' ? 0.06 : 0 }
    : { type: 'spring' as const, stiffness: 60, damping: 11, mass: Math.max(1, seconds) };

  return (
    <div className="absolute pointer-events-none" style={{ left: -SIDE, top: 0, width: W, height: H }}>
      <motion.div className="absolute inset-0" animate={idle ? { x: [-4, 4] } : undefined}
        transition={{ duration: 9, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}>
        {(['left', 'right'] as const).map(side => (
          // Reposo: cada mitad flota a su ritmo (casi lo mismo, para que no se abra la raya)
          <motion.div key={side} className="absolute inset-0"
            animate={idle ? (side === 'left' ? { x: [-1, 1.5], y: [0, 1.5] } : { x: [1, -1], y: [1, -0.5] }) : undefined}
            transition={{ duration: side === 'left' ? 6.5 : 8, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}>
            <motion.canvas ref={side === 'left' ? left : right} width={W} height={H} className="absolute left-0 top-0"
              style={{ width: W, height: H, imageRendering: 'pixelated', transformOrigin: side === 'left' ? '0% 100%' : '100% 100%' }}
              initial={false} animate={halfMove(side)} transition={lift(side)} />
          </motion.div>
        ))}
        {/* Reposo: jirones sueltos que pasan despacio por el borde y se deshacen */}
        {idle && idleSprites && (
          <motion.div className="absolute inset-0" initial={false} animate={{ y: top - bottom }} transition={lift('left')}>
            {IDLE_WISPS.map((w, i) => (
              <motion.img key={i} src={idleSprites[w.s].src} alt="" className="absolute pointer-events-none"
                style={{ left: SIDE + w.x * width - idleSprites[w.s].w / 2, top: bottom + w.y, width: idleSprites[w.s].w, height: idleSprites[w.s].h, imageRendering: 'pixelated' }}
                initial={{ x: 0, opacity: 0 }} animate={{ x: [0, w.dx], y: [0, -3], opacity: [0, 0.85, 0.85, 0], scale: [0.8, 1, 1.15] }}
                transition={{ duration: w.t, delay: w.delay, repeat: Infinity, repeatDelay: w.rest, ease: 'easeInOut', times: [0, 0.25, 0.7, 1] }} />
            ))}
          </motion.div>
        )}
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
