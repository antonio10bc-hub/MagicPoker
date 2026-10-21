import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useUiStore } from '@/store/useUiStore';
import { useTranslations } from '@/lib/i18n';
import { haptic, playSfx } from '@/lib/sounds';
import { INK } from '@/theme/tokens';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { HEART } from '@/components/pixel/sprites';
import { useStage } from '@/components/pixel/Stage';
import { BossFigure } from './BossFigure';

// --- FASE 2 DEL SOBERANO (Castillo) ---
// Cuando el Soberano baja a la mitad de sus vidas, la pelea se para: la pantalla se
// tiñe de rojo, él se alza temblando, su aura dorada y carmesí estalla y crece, sus
// corazones se rellenan uno a uno y suelta su frase. Se cierra tocando cuando ha
// terminado (como la presentación del Castillo).

const TAP_AFTER_MS = 2600;

export const Phase2Scene = () => {
  const t = useTranslations();
  const { height, width } = useStage();
  const { fx, lives } = useGameStore(useShallow(s => ({ fx: s.phase2Fx, lives: s.opponent.maxLives ?? s.opponent.lives })));
  const [closed, setClosed] = useState<number | null>(null);
  const open = fx !== null && closed !== fx;
  // Mientras se ve, los avisos (logros) esperan
  useEffect(() => {
    useUiStore.getState().setCinematic(open);
    return () => useUiStore.getState().setCinematic(false);
  }, [open]);
  const figureH = Math.min(140, Math.round(height * 0.3));

  useEffect(() => {
    if (fx === null) return;
    const timers = [
      setTimeout(() => { playSfx('crush', 1, 0.5); haptic('lifeLost'); }, 200),
      setTimeout(() => { playSfx('zap', 0.9, 0.45); haptic('stamp'); }, 1000),
      ...Array.from({ length: lives }, (_, i) => setTimeout(() => playSfx('sparkle', 0.5, 0.9 + i * 0.12), 1400 + i * 130)),
    ];
    return () => timers.forEach(clearTimeout);
  }, [fx, lives]);

  return (
    <AnimatePresence>
      {open && (
        <motion.button key={fx} aria-label="phase 2"
          className="absolute inset-0 z-[160] flex flex-col items-center justify-center gap-[6px] cursor-pointer"
          onClick={() => { if (Date.now() - fx >= TAP_AFTER_MS) setClosed(fx); }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.6 } }}
          style={{ background: 'radial-gradient(ellipse 65% 50% at 50% 42%, rgba(80,8,24,0.92) 0%, rgba(11,13,12,0.97) 72%)' }}>
          {/* Destello rojo al pararse todo */}
          <motion.div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--ink-crimson)' }}
            initial={{ opacity: 0.7 }} animate={{ opacity: [0.7, 0, 0.45, 0] }} transition={{ duration: 1.3, times: [0, 0.3, 0.75, 1] }} />
          <motion.span className="relative z-10 mb-[10px] font-display glow-crimson" style={{ color: 'var(--ink-crimson)', fontSize: 12, letterSpacing: 3 }}
            initial={{ opacity: 0, scale: 2 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, type: 'spring', stiffness: 400, damping: 14 }}>
            {t.phase2_tag}
          </motion.span>
          {/* Se alza temblando y su aura crece */}
          <motion.div style={{ transformOrigin: '50% 100%' }}
            initial={{ y: 30, scale: 0.8, filter: 'brightness(0.4)' }}
            animate={{ y: [30, 30, 0], scale: [0.8, 0.8, 1.08, 1], x: [0, -3, 3, -3, 3, 0, 0], filter: ['brightness(0.4)', 'brightness(0.6)', 'brightness(2.6)', 'brightness(1)'] }}
            transition={{ duration: 1.6, times: [0, 0.35, 0.7, 1] }}>
            <motion.div initial={{ scale: 0.6 }} animate={{ scale: [0.6, 0.6, 1.25, 1.1] }} transition={{ duration: 1.8, times: [0, 0.5, 0.8, 1] }}>
              <BossFigure id="sovereign" height={figureH} evolved />
            </motion.div>
          </motion.div>
          {/* Onda de oro al despertar */}
          <motion.div className="absolute rounded-full pointer-events-none" style={{ width: figureH, height: figureH, top: '42%', left: '50%', marginLeft: -figureH / 2, marginTop: -figureH / 2,
            boxShadow: '0 0 0 3px rgba(232,182,74,0.95), 0 0 16px 4px rgba(255,31,75,0.6)' }}
            initial={{ opacity: 0, scale: 0.2 }} animate={{ opacity: [0, 1, 0], scale: [0.2, 1.6, 2.6] }} transition={{ delay: 1, duration: 1.2, ease: 'easeOut' }} />
          <motion.span className="relative z-10 text-title glow-crimson" style={{ fontSize: 16, color: 'var(--ink-cream)', maxWidth: width - 24, textAlign: 'center' }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.6 }}>
            {t.phase2_title}
          </motion.span>
          {/* Sus corazones se rellenan uno a uno */}
          <div className="flex gap-[2px]">
            {Array.from({ length: lives }, (_, i) => (
              <motion.span key={i} initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.8, 1], opacity: 1 }} transition={{ delay: 1.4 + i * 0.13, duration: 0.35 }}>
                <PixelSprite sprite={HEART} tint={INK.orange} className="bloom-shape" />
              </motion.span>
            ))}
          </div>
          <motion.span className="px-[8px] py-[4px] rounded-[4px] text-center leading-[11px]"
            style={{ background: 'var(--ink-cream)', color: 'var(--ink-black)', maxWidth: Math.min(220, width - 24) }}
            initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 2.1, duration: 0.5 }}>
            {t.phase2_line}
          </motion.span>
        </motion.button>
      )}
    </AnimatePresence>
  );
};
