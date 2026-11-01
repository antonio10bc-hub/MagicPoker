import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { useGameLayout } from '@/components/pixel/Stage';
import { pausableTimeout } from '@/lib/clock';
import { JOKER_DRAW_BONUS, TIMINGS } from '@/lib/constants';
import { CARD_SIZE } from '@/theme/tokens';
import { Owner } from '@/types';
import { ScaledBack } from './Backs';

// --- EL JOKER ROBA ---
// Al revelarse un Joker en la pelea, se enciende (un halo ámbar que respira y un anillo)
// y de él salen sus cartas. Las tuyas son las cartas de verdad de tu mano, que entran
// desde el Joker (ver Hand en Hud.tsx); las del rival vuelan boca abajo hasta su panel,
// en un arco suave. Así se ve que roba, en lugar de un "+2" que no dice nada.

interface Glow { id: string; x: number; y: number }
interface Flight { id: string; owner: Owner; from: { x: number; y: number }; to: { x: number; y: number }; delay: number }

export const JokerDraw = () => {
  const phase = useGameStore(s => s.phase);
  const { board, rivalPanel } = useGameLayout();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [glows, setGlows] = useState<Glow[]>([]);

  useEffect(() => {
    if (phase !== 'combat') return;
    // Cuando se destapan las cartas del rival (como el resto de la coreografía)
    return pausableTimeout(() => {
      const { player, opponent } = useGameStore.getState();
      const next: Flight[] = [];
      const glows: Glow[] = [];
      (['player', 'opponent'] as Owner[]).forEach(owner => {
        (owner === 'player' ? player : opponent).board.forEach((s, i) => {
          if (s.card?.rank !== 'JOKER') return;
          const slot = board.slots[owner][i];
          const from = { x: slot.x + CARD_SIZE.width / 2, y: slot.y + CARD_SIZE.height / 2 };
          glows.push({ id: `${owner}-${i}-${Date.now()}`, x: slot.x, y: slot.y });
          // Las tuyas las trae la propia mano (salen de aquí)
          if (owner === 'player') return;
          const to = { x: rivalPanel.x + rivalPanel.w / 2, y: rivalPanel.y + rivalPanel.h / 2 };
          for (let k = 0; k < JOKER_DRAW_BONUS; k++) next.push({ id: `${owner}-${i}-${k}-${Date.now()}`, owner, from, to, delay: 0.35 + k * 0.32 });
        });
      });
      if (next.length) setFlights(next);
      if (glows.length) setGlows(glows);
    }, TIMINGS.combatFlip + 20);
  }, [phase, board, rivalPanel]);

  // Se van solas al terminar de volar
  useEffect(() => {
    if (!flights.length && !glows.length) return;
    const id = setTimeout(() => { setFlights([]); setGlows([]); }, 2200);
    return () => clearTimeout(id);
  }, [flights, glows]);

  const W = 18;
  return (
    <div className="absolute inset-0 pointer-events-none z-[70]">
      <AnimatePresence>
        {/* El Joker se enciende: halo ámbar que respira y un anillo que se abre */}
        {glows.map(g => (
          <motion.div key={g.id} className="absolute rounded-[4px]" style={{ left: g.x - 3, top: g.y - 3, width: CARD_SIZE.width + 6, height: CARD_SIZE.height + 6,
            boxShadow: '0 0 0 1px rgba(255,194,51,0.9), 0 0 14px 4px rgba(255,194,51,0.55)' }}
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: [0, 1, 0.8, 0], scale: [0.9, 1.06, 1.02, 1.1] }}
            transition={{ duration: 1.9, times: [0, 0.2, 0.7, 1], ease: 'easeInOut' }} exit={{ opacity: 0 }} />
        ))}
        {flights.map(f => (
          <motion.div key={f.id} className="absolute" style={{ left: f.from.x - W / 2, top: f.from.y - W * 0.7 }}
            initial={{ x: 0, y: 0, scale: 0.3, opacity: 0, rotate: -12 }}
            animate={{ x: [0, (f.to.x - f.from.x) * 0.25, f.to.x - f.from.x], y: [0, -30, f.to.y - f.from.y], scale: [0.3, 1, 0.6], opacity: [0, 1, 1, 0], rotate: [-12, 6, 0] }}
            transition={{ duration: 1.4, delay: f.delay, ease: [0.45, 0, 0.25, 1], times: [0, 0.35, 1] }}
            exit={{ opacity: 0 }}>
            <ScaledBack owner={f.owner} w={W} style={{ boxShadow: '0 0 8px 2px rgba(255,194,51,0.5)' }} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
