import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useLowPower } from '@/lib/quality';
import { hash } from './MapTerrain';

// --- VIDA DEL BOSQUE (reposo) ---
// Lo que se mueve en la pantalla del Bosque, sutil pero que se vea. Nada en bajo consumo.
//  · Detrás (entre los troncos lejanos y los de en medio): jirones de niebla que cruzan
//    despacio por el horizonte y dos rayos de luna que bajan entre las copas y respiran.
//  · Delante (entre los de en medio y los cercanos): luciérnagas menta que se encienden y
//    dan una vuelta, y alguna hoja que cae meciéndose.
//  · ForestWatchers: otros ojos ámbar, pequeños, que asoman en la oscuridad de los lados,
//    parpadean y se apagan (solo mientras nadie sale del bosque).
// Al buscar duelo, las luciérnagas y las hojas se apagan para que todo mire al centro.

type Props = { W: number; H: number; horizon: number; layer: 'back' | 'front'; busy: boolean };

export const ForestLife = memo(({ W, H, horizon, layer, busy }: Props) => {
  const lowPower = useLowPower();
  const flies = useMemo(() => Array.from({ length: 9 }, (_, i) => {
    // A los lados y abajo, fuera del centro donde están los ojos
    const side = i % 2 ? 1 : -1;
    return {
      x: Math.round(W / 2 + side * (W * 0.12 + hash(i, 1, 61) * W * 0.36)),
      y: Math.round(horizon + hash(i, 2, 63) * (H - horizon) * 0.7 - H * 0.08),
      dx: (hash(i, 3, 65) - 0.5) * 24, dy: -6 - hash(i, 4, 67) * 12,
      t: 3.5 + hash(i, 5, 69) * 2.5, delay: hash(i, 6, 71) * 6, rest: 0.8 + hash(i, 7, 73) * 3,
    };
  }), [W, H, horizon]);
  const leaves = useMemo(() => Array.from({ length: 5 }, (_, i) => ({
    x: Math.round(W * (0.08 + hash(i, 1, 81) * 0.84)), fall: H * (0.55 + hash(i, 2, 83) * 0.35),
    t: 7 + hash(i, 3, 85) * 5, delay: 1 + i * 2.6 + hash(i, 4, 87) * 2, rest: 4 + hash(i, 5, 89) * 6, drift: (hash(i, 6, 91) - 0.5) * 50,
  })), [W, H]);
  if (lowPower) return null;

  if (layer === 'back') {
    return (
      <div className="absolute inset-0 pointer-events-none">
        {/* Rayos de luna entre las copas */}
        {[{ x: 0.36, r: 14, d: 0 }, { x: 0.64, r: -10, d: 3 }].map((b, i) => (
          <motion.div key={i} className="absolute" style={{ left: W * b.x - 14, top: -H * 0.05, width: 28, height: horizon + H * 0.12, rotate: b.r, transformOrigin: '50% 0%',
            background: 'linear-gradient(to right, transparent, rgba(237,235,224,0.09) 35%, rgba(237,235,224,0.09) 65%, transparent)',
            maskImage: 'linear-gradient(to bottom, transparent, black 15%, rgba(0,0,0,0.5) 70%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, rgba(0,0,0,0.5) 70%, transparent)' }}
            animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 7, delay: b.d, repeat: Infinity, ease: 'easeInOut' }} />
        ))}
        {/* Jirones de niebla que cruzan por el horizonte */}
        {[{ y: -0.02, w: 1.1, t: 26, d: 0, dir: 1 }, { y: 0.04, w: 0.8, t: 34, d: 8, dir: -1 }, { y: 0.1, w: 0.9, t: 30, d: 15, dir: 1 }].map((f, i) => (
          <motion.div key={`f${i}`} className="absolute" style={{ left: 0, top: horizon + H * f.y - 18, width: W * f.w, height: 36,
            background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(185,207,200,0.16) 0%, rgba(185,207,200,0.06) 45%, transparent 72%)' }}
            initial={{ x: f.dir > 0 ? -W * f.w : W }} animate={{ x: f.dir > 0 ? [-W * f.w, W] : [W, -W * f.w] }}
            transition={{ duration: f.t, delay: f.d, repeat: Infinity, ease: 'linear' }} />
        ))}
      </div>
    );
  }
  return (
    <motion.div className="absolute inset-0 pointer-events-none" animate={{ opacity: busy ? 0 : 1 }} transition={{ duration: 0.5 }}>
      {flies.map((f, i) => (
        <motion.span key={i} className="absolute rounded-full" style={{ left: f.x, top: f.y, width: 2, height: 2, background: 'var(--ink-cream)',
          boxShadow: '0 0 4px 2px rgba(185,207,200,0.7), 0 0 10px 3px rgba(185,207,200,0.25)' }}
          initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.5, 1, 0], x: [0, f.dx * 0.4, f.dx * 0.8, f.dx], y: [0, f.dy * 0.6, f.dy * 0.3, f.dy] }}
          transition={{ duration: f.t, delay: f.delay, repeat: Infinity, repeatDelay: f.rest, ease: 'easeInOut' }} />
      ))}
      {/* Hojas: un par de píxeles oscuros con filo claro que caen meciéndose */}
      {leaves.map((l, i) => (
        <motion.span key={`l${i}`} className="absolute" style={{ left: l.x, top: H * 0.06, width: 3, height: 2, background: 'var(--ink-slate)', boxShadow: '0 -1px 0 var(--ink-teal)' }}
          initial={{ opacity: 0 }} animate={{ y: [0, l.fall], x: [0, l.drift * 0.5, -l.drift * 0.3, l.drift], rotate: [0, 90, 200, 320], opacity: [0, 1, 1, 0] }}
          transition={{ duration: l.t, delay: l.delay, repeat: Infinity, repeatDelay: l.rest, ease: 'easeInOut' }} />
      ))}
    </motion.div>
  );
});
ForestLife.displayName = 'ForestLife';

/** Un par de ojos pequeños que asoma en un sitio de los lados y se va (animación CSS `anim-eyes`) */
const Watcher = ({ W, H, horizon, index }: { W: number; H: number; horizon: number; index: number }) => {
  const [show, setShow] = useState<{ x: number; y: number; s: number; key: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let n = 0;
    const next = (delay: number) => {
      timer.current = setTimeout(() => {
        const side = Math.random() < 0.5 ? -1 : 1;
        const s = 2.8 + Math.random() * 2;
        setShow({ x: Math.round(W / 2 + side * (W * 0.16 + Math.random() * W * 0.28)), y: Math.round(horizon - H * 0.04 + Math.random() * H * 0.16), s, key: ++n });
        timer.current = setTimeout(() => { setShow(null); next(1500 + Math.random() * 4500); }, s * 1000);
      }, delay);
    };
    next(1500 + index * 2500 + Math.random() * 2000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [W, H, horizon, index]);
  if (!show) return null;
  const eye = { width: 2, height: 1, background: 'var(--ink-amber)', boxShadow: '0 0 2px rgba(255,194,51,0.9), 0 0 5px 1px rgba(255,194,51,0.4)' };
  return (
    <div key={show.key} className="absolute flex gap-[2px] anim-eyes" style={{ left: show.x, top: show.y, animationDuration: `${show.s}s` }}>
      <span style={eye} /><span style={eye} />
    </div>
  );
};

export const ForestWatchers = memo(({ W, H, horizon }: { W: number; H: number; horizon: number }) => {
  const lowPower = useLowPower();
  if (lowPower) return null;
  return (
    <div className="absolute inset-0 pointer-events-none">
      {[0, 1].map(i => <Watcher key={i} index={i} W={W} H={H} horizon={horizon} />)}
    </div>
  );
});
ForestWatchers.displayName = 'ForestWatchers';
