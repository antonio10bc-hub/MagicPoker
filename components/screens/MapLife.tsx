import { memo, useMemo, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { Biome, hash, Pt } from './MapTerrain';
import { useLowPower } from '@/lib/quality';

// --- VIDA DEL MAPA (reposo) ---
// Detalles pequeños que hacen que el mapa respire sin llamar la atención:
//  - Luciérnagas en el bosque (lejos del camino y de los pueblos): motas menta que se
//    encienden, dan una vuelta corta y se apagan, cada una a su ritmo.
//  - Destellos en el agua (rayitas crema que aparecen y se van) y burbujas en la ciénaga.
//  - De vez en cuando, una bandada de pájaros pequeños cruza el mapa muy alta.
// Nada de esto en bajo consumo.

type Ellipse = { x: number; y: number; rx: number; ry: number };
const inside = (p: Pt, e: Ellipse, pad = 0) => ((p.x - e.x) / (e.rx + pad)) ** 2 + ((p.y - e.y) / (e.ry + pad)) ** 2 < 1;

/** Luciérnagas: una cada ~60 px de alto, en el bosque */
const firefliesFor = (w: number, h: number, road: Pt[], keepOut: Ellipse[]) => {
  const out: { x: number; y: number; dx: number; dy: number; t: number; delay: number; rest: number }[] = [];
  const n = Math.round(h / 60);
  for (let i = 0, tries = 0; out.length < n && tries < n * 12; tries++, i++) {
    const p = { x: Math.round(8 + hash(i, 1, 201) * (w - 16)), y: Math.round(30 + hash(i, 2, 203) * (h - 60)) };
    if (keepOut.some(e => inside(p, e, 6))) continue;
    if (road.some(r => Math.abs(r.y - p.y) < 30 && Math.abs(r.x - p.x) < 26)) continue;
    out.push({ ...p, dx: (hash(i, 3, 205) - 0.5) * 22, dy: -4 - hash(i, 4, 207) * 10,
      t: 3.5 + hash(i, 5, 209) * 2.5, delay: hash(i, 6, 211) * 8, rest: 1 + hash(i, 7, 213) * 3.5 });
  }
  return out;
};

const Firefly = ({ f }: { f: ReturnType<typeof firefliesFor>[number] }) => (
  <motion.span className="absolute pointer-events-none rounded-full"
    style={{ left: f.x, top: f.y, width: 2, height: 2, background: 'var(--ink-cream)', boxShadow: '0 0 4px 2px rgba(185,207,200,0.7), 0 0 10px 3px rgba(185,207,200,0.25)' }}
    initial={{ opacity: 0 }}
    animate={{ opacity: [0, 1, 0.5, 1, 0], x: [0, f.dx * 0.4, f.dx * 0.8, f.dx], y: [0, f.dy * 0.6, f.dy * 0.3, f.dy] }}
    transition={{ duration: f.t, delay: f.delay, repeat: Infinity, repeatDelay: f.rest, ease: 'easeInOut' }} />
);

/** Destellos del agua y burbujas de la ciénaga, repartidos por su elipse */
const glintsFor = (b: Biome, k: number) => {
  const n = b.kind === 'water' ? Math.max(6, Math.round((b.rx * b.ry) / 70)) : b.kind === 'swamp' ? 7 : 0;
  return Array.from({ length: n }, (_, i) => {
    const a = hash(i, k, 221) * Math.PI * 2, r = Math.sqrt(hash(i, k, 223)) * 0.75;
    return { x: Math.round(b.x + Math.cos(a) * b.rx * r), y: Math.round(b.y + Math.sin(a) * b.ry * r),
      w: 3 + Math.round(hash(i, k, 225) * 4), t: 2.2 + hash(i, k, 227) * 1.6, delay: hash(i, k, 229) * 4, rest: 0.8 + hash(i, k, 231) * 2.5 };
  });
};

const Glint = ({ g }: { g: ReturnType<typeof glintsFor>[number] }) => (
  <motion.span className="absolute pointer-events-none"
    style={{ left: g.x - g.w / 2, top: g.y, width: g.w, height: 1, background: 'var(--ink-cream)', boxShadow: '0 0 4px 1px rgba(237,235,224,0.75)' }}
    initial={{ opacity: 0, scaleX: 0.3 }} animate={{ opacity: [0, 1, 0], scaleX: [0.3, 1, 0.6] }}
    transition={{ duration: g.t, delay: g.delay, repeat: Infinity, repeatDelay: g.rest, ease: 'easeInOut' }} />
);

const Bubble = ({ g }: { g: ReturnType<typeof glintsFor>[number] }) => (
  <motion.span className="absolute pointer-events-none rounded-full"
    style={{ left: g.x - 2, top: g.y - 2, width: 5, height: 5, border: '1px solid var(--ink-mint)' }}
    initial={{ opacity: 0, scale: 0.2 }} animate={{ opacity: [0, 0.9, 0], scale: [0.2, 1, 1.4], y: [0, -2, -3] }}
    transition={{ duration: g.t, delay: g.delay, repeat: Infinity, repeatDelay: g.rest + 1, ease: 'easeOut' }} />
);

/** Bandada: cinco pájaros en uve (dos píxeles de ala que aletean) */
const Bird = ({ x, y, delay }: { x: number; y: number; delay: number }) => (
  <motion.span className="absolute" style={{ left: x, top: y, width: 5, height: 2 }}
    animate={{ scaleY: [1, -0.6, 1] }} transition={{ duration: 0.5, delay, repeat: Infinity, ease: 'easeInOut' }}>
    <span className="absolute" style={{ left: 0, top: 0, width: 2, height: 1, background: 'var(--ink-mint)' }} />
    <span className="absolute" style={{ left: 2, top: 1, width: 1, height: 1, background: 'var(--ink-mint)' }} />
    <span className="absolute" style={{ left: 3, top: 0, width: 2, height: 1, background: 'var(--ink-mint)' }} />
  </motion.span>
);
const FLOCK = [{ x: 0, y: 0 }, { x: -7, y: 4 }, { x: -6, y: -4 }, { x: -13, y: 7 }, { x: -12, y: -7 }];

const Flock = ({ w, y }: { w: number; y: number }) => (
  <motion.div className="absolute pointer-events-none" style={{ left: 0, top: y, opacity: 0.9 }}
    initial={{ x: -30 }} animate={{ x: [-30, w + 30], y: [0, -24, -10] }}
    transition={{ duration: 16, repeat: Infinity, repeatDelay: 9, delay: 3, ease: 'linear' }}>
    {FLOCK.map((b, i) => <Bird key={i} x={b.x} y={b.y} delay={i * 0.12} />)}
  </motion.div>
);

/** Solo en el navegador: son adornos animados y así no hay nada que casar con el HTML del servidor */
const noSubscribe = () => () => {};
const useMounted = () => useSyncExternalStore(noSubscribe, () => true, () => false);

export const MapLife = memo(({ width, height, road, keepOut, biomes, flockY }: {
  width: number; height: number; road: Pt[]; keepOut: Ellipse[]; biomes: Biome[];
  /** A qué altura cruzan los pájaros (cerca de donde mira la cámara al empezar) */
  flockY: number;
}) => {
  const lowPower = useLowPower();
  const flies = useMemo(() => firefliesFor(width, height, road, keepOut), [width, height, road, keepOut]);
  const glints = useMemo(() => biomes.map((b, k) => ({ kind: b.kind, list: glintsFor(b, k) })), [biomes]);
  const mounted = useMounted();
  if (lowPower || !mounted) return null;
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
      {glints.map(({ kind, list }, k) => list.map((g, i) => (kind === 'water' ? <Glint key={`${k}-${i}`} g={g} /> : <Bubble key={`${k}-${i}`} g={g} />)))}
      {flies.map((f, i) => <Firefly key={i} f={f} />)}
      <Flock w={width} y={flockY} />
    </div>
  );
});
MapLife.displayName = 'MapLife';
