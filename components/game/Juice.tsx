import { ReactNode, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { useFxStore } from '@/components/fx/fxStore';

// --- "JUICE": PEQUEÑOS EFECTOS QUE DAN PESO A LO QUE PASA ---
// Solo presentación: escuchan el estado y la cámara (fxStore).

/**
 * Momento decisivo a cámara lenta: bandas de cine que entran por arriba y por abajo,
 * el color se apaga y un viñeteado cierra el plano. Lo dispara el director de combate
 * con fx.slowmo() en la pelea que deja a alguien sin vidas.
 */
export const SlowMoLayer = () => {
  const slowmo = useFxStore(s => s.slowmo);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    if (!slowmo) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se enciende al llegar el aviso
    setActive(slowmo.id);
    const off = setTimeout(() => setActive(id => (id === slowmo.id ? null : id)), slowmo.intensity * 1000);
    return () => clearTimeout(off);
  }, [slowmo]);
  const bar = { duration: 0.45, ease: 'easeOut' } as const;
  return (
    <AnimatePresence>
      {active !== null && (
        <motion.div key={active} className="absolute inset-0 z-[120] pointer-events-none" exit={{ opacity: 0, transition: { duration: 0.5 } }}>
          {/* Color apagado y viñeta */}
          <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
            style={{ backdropFilter: 'saturate(0.35) contrast(1.1)', WebkitBackdropFilter: 'saturate(0.35) contrast(1.1)',
              background: 'radial-gradient(ellipse 60% 55% at 50% 50%, transparent 45%, rgba(11,13,12,0.6) 100%)' }} />
          {/* Bandas de cine */}
          <motion.div className="absolute inset-x-0 top-0" style={{ height: '9%', background: 'var(--ink-black)' }}
            initial={{ y: '-100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }} transition={bar} />
          <motion.div className="absolute inset-x-0 bottom-0" style={{ height: '9%', background: 'var(--ink-black)' }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={bar} />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/** Al perder vidas: los bordes de la pantalla laten en rojo un instante */
export const HurtFlash = () => {
  const lives = useGameStore(s => s.player.lives);
  const last = useRef(lives);
  const [hit, setHit] = useState<{ id: number; amount: number } | null>(null);
  useEffect(() => {
    const prev = last.current;
    last.current = lives;
    if (lives < prev) setHit({ id: Date.now(), amount: prev - lives });
  }, [lives]);
  return (
    <AnimatePresence>
      {hit && (
        <motion.div key={hit.id} className="absolute inset-0 z-[110] pointer-events-none"
          style={{ boxShadow: `inset 0 0 ${30 + hit.amount * 14}px ${8 + hit.amount * 6}px rgba(255,31,75,0.75)` }}
          initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.7, times: [0, 0.15, 1] }}
          onAnimationComplete={() => setHit(h => (h?.id === hit.id ? null : h))} />
      )}
    </AnimatePresence>
  );
};

/** El jefe del panel se encoge y se enciende de rojo cuando pierde vidas */
export const Flinch = ({ children }: { children: ReactNode }) => {
  const lives = useGameStore(s => s.opponent.lives);
  const last = useRef(lives);
  const controls = useAnimationControls();
  useEffect(() => {
    const prev = last.current;
    last.current = lives;
    if (lives >= prev) return;
    controls.start({
      x: [0, -3, 3, -2, 2, 0], scaleY: [1, 0.82, 1.08, 1], scaleX: [1, 1.12, 0.96, 1],
      filter: ['brightness(1)', 'brightness(2.4) saturate(1.6)', 'brightness(1)'],
      transition: { duration: 0.45 },
    });
  }, [lives, controls]);
  return <motion.div animate={controls} style={{ transformOrigin: '50% 100%' }}>{children}</motion.div>;
};
