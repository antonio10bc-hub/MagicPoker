import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Pt } from './MapTerrain';
import { useLowPower } from '@/lib/quality';

// --- OJOS EN EL BOSQUE DEL MAPA (con el Bosque abierto) ---
// En el bosque que rodea al Castillo, unos ojos ámbar pequeños (los del Bosque) se
// abren entre los árboles, parpadean, miran a un lado y a otro y se apagan, y al rato
// salen en otro sitio. Nunca encima del Castillo ni del camino.

/** Cuántos pares a la vez (en bajo consumo, menos) */
const SLOTS = 5;
const SLOTS_LOW = 3;

/** Sitios posibles: un anillo alrededor del Castillo, entre los árboles */
const spotsAround = (castle: Pt, w: number): Pt[] => {
  const out: Pt[] = [];
  const cy = castle.y - 50;
  for (let i = 0; i < 28; i++) {
    // Reparto determinista (ángulo dorado) por un anillo de 58 a 112 px
    const a = i * 2.399;
    const r = 58 + ((i * 37) % 55);
    const x = Math.round(castle.x + Math.cos(a) * r * 1.3);
    const y = Math.round(cy + Math.sin(a) * r * 0.9);
    // Dentro del mapa, por encima de los primeros pueblos y fuera del Castillo y el camino
    if (x < 8 || x > w - 12 || y < 6 || y > castle.y + 70) continue;
    if (Math.abs(x - castle.x) < 48 && y > cy - 62) continue;
    if (Math.abs(x - castle.x) < 14) continue;
    out.push({ x, y });
  }
  return out;
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Un par de ojos: se abre, parpadea, mira y se cierra (una sola animación) */
const Pair = memo(({ at, seconds, onDone }: { at: Pt; seconds: number; onDone: () => void }) => {
  const eye = { width: 3, height: 2, background: 'var(--ink-amber)', boxShadow: '0 0 3px 1px rgba(255,194,51,0.95), 0 0 8px 2px rgba(255,194,51,0.5)' };
  return (
    <motion.div className="absolute flex gap-[3px] pointer-events-none" style={{ left: at.x, top: at.y }}
      initial={{ opacity: 0, scaleY: 0.1, x: 0 }}
      animate={{ opacity: [0, 1, 1, 1, 1, 1, 1, 0], scaleY: [0.1, 1, 1, 0.1, 1, 1, 1, 0.1], x: [0, 0, 0, 0, 1, -1, 0, 0] }}
      transition={{ duration: seconds, times: [0, 0.1, 0.4, 0.45, 0.55, 0.75, 0.9, 1], ease: 'easeInOut' }}
      onAnimationComplete={onDone}>
      <span style={eye} /><span style={eye} />
    </motion.div>
  );
});
Pair.displayName = 'Pair';

/** Un hueco: espera, enseña un par en un sitio libre y vuelve a empezar */
const Slot = ({ spots, taken, index }: { spots: Pt[]; taken: React.MutableRefObject<Set<number>>; index: number }) => {
  const [show, setShow] = useState<{ spot: number; seconds: number; key: number } | null>(null);
  const counter = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const next = (delay: number) => {
    timer.current = setTimeout(() => {
      const free = spots.map((_, i) => i).filter(i => !taken.current.has(i));
      if (!free.length) return next(1500);
      const spot = free[Math.floor(Math.random() * free.length)];
      taken.current.add(spot);
      setShow({ spot, seconds: rand(3.2, 5.5), key: ++counter.current });
    }, delay);
  };
  useEffect(() => {
    // Cada hueco arranca a su ritmo para que no salgan todos a la vez
    next(600 + index * 1400 + rand(0, 1200));
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!show) return null;
  return (
    <Pair key={show.key} at={spots[show.spot]} seconds={show.seconds}
      onDone={() => { taken.current.delete(show.spot); setShow(null); next(rand(1200, 4500)); }} />
  );
};

export const MapEyes = ({ castle, width }: { castle: Pt; width: number }) => {
  const spots = useMemo(() => spotsAround(castle, width), [castle, width]);
  const taken = useRef(new Set<number>());
  const n = useLowPower() ? SLOTS_LOW : SLOTS;
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
      {Array.from({ length: n }, (_, i) => <Slot key={i} index={i} spots={spots} taken={taken} />)}
    </div>
  );
};
