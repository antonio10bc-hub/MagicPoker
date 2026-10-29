import { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { Owner } from '@/types';
import { CARD_SIZE } from '@/theme/tokens';
import { CardBack, useCardBack } from './Card';

// --- DORSOS FUERA DE LA CARTA ---
// El dorso elegido (y el del jefe rival) en los sitios donde se ven cartas boca abajo:
// el mazo y la mano del rival en el panel, el barajado del cara o cruz, el abanico de la
// pantalla final y el botón del mazo. Solo pintan: no tocan la partida.

/** Dorso de verdad, encogido al ancho `w` (el alto sigue la proporción de la carta) */
export const ScaledBack = ({ owner, back, w, style, className }: { owner: Owner; back?: string; w: number; style?: CSSProperties; className?: string }) => {
  const mine = useCardBack(owner);
  const s = w / CARD_SIZE.width;
  return (
    <div className={`relative overflow-hidden rounded-[1px] shrink-0 ${className ?? ''}`} style={{ width: w, height: Math.round(CARD_SIZE.height * s), ...style }}>
      <div className="absolute left-0 top-0" style={{ width: CARD_SIZE.width, height: CARD_SIZE.height, transform: `scale(${s})`, transformOrigin: '0 0' }}>
        <CardBack owner={owner} back={back ?? mine} />
      </div>
    </div>
  );
};

/** Barajado: el mazo se parte en dos y las cartas se intercalan, una y otra vez */
export const DeckShuffle = ({ owner = 'player', w = 22 }: { owner?: Owner; w?: number }) => {
  const h = Math.round((CARD_SIZE.height * w) / CARD_SIZE.width);
  const N = 6;
  return (
    <div className="relative pointer-events-none" style={{ width: w * 3, height: h + 6 }} aria-hidden>
      {Array.from({ length: N }, (_, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        const out = side * w * 0.8;
        // Cada carta vuelve al montón un poco después que la anterior: se intercalan
        const back = 0.42 + i * 0.05;
        return (
          <motion.div key={i} className="absolute" style={{ left: w, top: 4, zIndex: i }}
            animate={{ x: [0, out, out, 0, 0], y: [0, -3, -3, -i * 0.5, 0], rotate: [0, side * 9, side * 9, 0, 0] }}
            transition={{ duration: 1.7, times: [0, 0.22, back, back + 0.08, 1], ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.4 }}>
            <ScaledBack owner={owner} w={w} style={{ boxShadow: '0 1px 0 rgba(11,13,12,0.6)' }} />
          </motion.div>
        );
      })}
    </div>
  );
};

/** Abanico de tus cartas boca abajo (pantalla final): abierto al ganar, desparramado al perder */
export const BackFan = ({ win, w = 26 }: { win: boolean; w?: number }) => {
  const h = Math.round((CARD_SIZE.height * w) / CARD_SIZE.width);
  const N = 5;
  return (
    <div className="relative pointer-events-none" style={{ width: w, height: h }} aria-hidden>
      {Array.from({ length: N }, (_, i) => {
        const k = i - (N - 1) / 2;
        const target = win
          ? { rotate: k * 15, x: k * 7, y: Math.abs(k) * 2, opacity: 1 }
          : { rotate: k * 23 + (i % 2 ? 8 : -6), x: k * 11, y: 10 + Math.abs(k) * 4, opacity: 0.55 };
        return (
          <motion.div key={i} className="absolute left-0 top-0" style={{ transformOrigin: '50% 100%' }}
            initial={{ rotate: 0, x: 0, y: 30, opacity: 0 }} animate={target}
            transition={{ type: 'spring', stiffness: 180, damping: win ? 12 : 18, delay: 0.45 + i * 0.07 }}>
            <ScaledBack owner="player" w={w} className={win ? 'bloom' : undefined} />
          </motion.div>
        );
      })}
    </div>
  );
};
