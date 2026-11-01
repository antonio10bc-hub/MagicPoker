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
// Al revelarse un Joker en la pelea, de él salen sus cartas boca abajo, una tras otra,
// y vuelan a la mano de quien lo jugó (la tuya, abajo; la del rival, a su panel). Así se
// ve que roba, en lugar de un "+2" que no dice nada.

interface Flight { id: string; owner: Owner; from: { x: number; y: number }; to: { x: number; y: number }; delay: number }

export const JokerDraw = () => {
  const phase = useGameStore(s => s.phase);
  const { board, hand, rivalPanel } = useGameLayout();
  const [flights, setFlights] = useState<Flight[]>([]);

  useEffect(() => {
    if (phase !== 'combat') return;
    // Cuando se destapan las cartas del rival (como el resto de la coreografía)
    return pausableTimeout(() => {
      const { player, opponent } = useGameStore.getState();
      const next: Flight[] = [];
      (['player', 'opponent'] as Owner[]).forEach(owner => {
        (owner === 'player' ? player : opponent).board.forEach((s, i) => {
          if (s.card?.rank !== 'JOKER') return;
          const slot = board.slots[owner][i];
          const from = { x: slot.x + CARD_SIZE.width / 2, y: slot.y + CARD_SIZE.height / 2 };
          const to = owner === 'player'
            ? { x: hand.x + hand.w / 2, y: hand.y + 20 }
            : { x: rivalPanel.x + rivalPanel.w / 2, y: rivalPanel.y + rivalPanel.h / 2 };
          for (let k = 0; k < JOKER_DRAW_BONUS; k++) next.push({ id: `${owner}-${i}-${k}-${Date.now()}`, owner, from, to, delay: 0.15 + k * 0.28 });
        });
      });
      if (next.length) setFlights(next);
    }, TIMINGS.combatFlip + 20);
  }, [phase, board, hand, rivalPanel]);

  // Se van solas al terminar de volar
  useEffect(() => {
    if (!flights.length) return;
    const id = setTimeout(() => setFlights([]), 1800);
    return () => clearTimeout(id);
  }, [flights]);

  const W = 18;
  return (
    <div className="absolute inset-0 pointer-events-none z-[70]">
      <AnimatePresence>
        {flights.map(f => (
          <motion.div key={f.id} className="absolute" style={{ left: f.from.x - W / 2, top: f.from.y - W * 0.7 }}
            initial={{ x: 0, y: 0, scale: 0.4, opacity: 0, rotate: -20 }}
            animate={{ x: [0, (f.to.x - f.from.x) * 0.35, f.to.x - f.from.x], y: [0, -26, f.to.y - f.from.y], scale: [0.4, 1.15, 0.7], opacity: [0, 1, 1, 0], rotate: [-20, 8, 0] }}
            transition={{ duration: 1.05, delay: f.delay, ease: 'easeInOut', times: [0, 0.4, 1] }}
            exit={{ opacity: 0 }}>
            <ScaledBack owner={f.owner} w={W} style={{ boxShadow: '0 0 6px 2px rgba(255,194,51,0.55)' }} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
