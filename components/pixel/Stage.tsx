import { ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { STAGE, steps } from '@/theme/tokens';
import { useGameStore } from '@/store/useGameStore';
import { LETTERBOX_TILE, patternUri } from './patterns';

// --- ESCALADO ENTERO ---
// La escala se calcula en píxeles FÍSICOS (devicePixelRatio) para que cada píxel
// interno ocupe un número entero de píxeles reales. Si el entero deja el juego
// demasiado pequeño (< 80 % del hueco), se usa el ajuste exacto.
const MIN_FILL = 0.8;

const computeScale = (): number => {
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min(window.innerWidth / STAGE.width, window.innerHeight / STAGE.height);
  const integer = Math.floor(fit * dpr) / dpr;
  return integer >= fit * MIN_FILL && integer > 0 ? integer : fit;
};

const subscribeResize = (cb: () => void) => {
  window.addEventListener('resize', cb);
  return () => window.removeEventListener('resize', cb);
};

const useStageScale = () => useSyncExternalStore(subscribeResize, computeScale, () => 2);

/** Flash blanco + sacudida de pantalla cuando se resuelve un combate */
const useImpactFx = () => {
  const shake = useAnimationControls();
  const [flashKey, setFlashKey] = useState(0);
  const combat = useGameStore(s => s.pendingCombatResult);

  useEffect(() => {
    if (!combat) return;
    const hasImpact = combat.deadCardIds.length + combat.voidedCardIds.length + combat.playerDamageTaken + combat.opponentDamageTaken > 0;
    if (!hasImpact) return;
    // El flash y la sacudida se disparan desde el efecto (no en el render)
    const id = requestAnimationFrame(() => setFlashKey(k => k + 1));
    shake.start({ x: [0, -2, 2, -1, 1, 0], y: [0, 1, -1, 1, 0, 0], transition: { duration: 0.2, ease: 'linear' } });
    return () => cancelAnimationFrame(id);
  }, [combat, shake]);

  return { shake, flashKey };
};

export const Stage = ({ children }: { children: ReactNode }) => {
  const scale = useStageScale();
  const { shake, flashKey } = useImpactFx();

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{ backgroundImage: patternUri('letterbox', LETTERBOX_TILE), backgroundSize: `${8 * scale}px` }}
    >
      <div style={{ width: STAGE.width * scale, height: STAGE.height * scale, position: 'relative' }}>
        <div
          className="stage absolute left-0 top-0 overflow-hidden"
          style={{ width: STAGE.width, height: STAGE.height, transform: `scale(${scale})`, transformOrigin: '0 0', background: 'var(--c-outline)' }}
        >
          <motion.div animate={shake} className="absolute inset-0">
            {children}
          </motion.div>
          {flashKey > 0 && (
            <motion.div
              key={flashKey}
              className="absolute inset-0 pointer-events-none z-[999]"
              style={{ background: 'var(--c-white)' }}
              initial={{ opacity: 0.9 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.1, ease: steps(2) }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
