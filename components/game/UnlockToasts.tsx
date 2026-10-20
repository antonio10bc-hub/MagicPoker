import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { useUiStore } from '@/store/useUiStore';
import { useTranslations, Translations } from '@/lib/i18n';
import { haptic, playSfx } from '@/lib/sounds';
import { INK } from '@/theme/tokens';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { SEAL_ICONS } from '@/components/pixel/sprites';
import { useStage } from '@/components/pixel/Stage';

// --- DESBLOQUEOS DE BOSS ---
// Al vencer a un boss: un sello nuevo (o la colección, con el primero) aparece en verde
// eléctrico en el centro. Espera a que acabe la pelea y va antes que los logros.

export const UnlockToasts = () => {
  const t = useTranslations();
  const { width, height } = useStage();
  const current = useUiStore(s => s.unlockQueue[0]);
  const shift = useUiStore(s => s.shiftUnlock);
  const busy = useGameStore(s => s.phase === 'combat');
  // El premio del boss va primero; los logros esperan a que termine
  const show = current && !busy;

  useEffect(() => {
    if (!show) return;
    const slam = setTimeout(() => { playSfx('wipe', 0.6, 1.3); playSfx('sparkle'); haptic('win'); }, 150);
    const done = setTimeout(shift, 3600);
    return () => { clearTimeout(slam); clearTimeout(done); };
  }, [show, current, shift]);

  const w = Math.min(200, width - 16);
  const seal = current?.kind === 'seal' ? current.seal : null;
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          key={seal ?? 'collection'}
          className="absolute z-[300] flex flex-col items-center gap-[8px] cursor-pointer"
          style={{ left: (width - w) / 2, top: Math.round(height * 0.22), width: w }}
          onClick={shift}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -12, transition: { duration: 0.25 } }}
        >
          <div className="relative">
            <motion.div className="absolute rounded-full" style={{ inset: -10, boxShadow: '0 0 0 2px rgba(125,255,43,0.8), 0 0 22px 6px rgba(125,255,43,0.4)' }}
              initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: [0.5, 1.6], opacity: [0, 1, 0] }} transition={{ duration: 0.8, delay: 0.15 }} />
            <motion.div className="flex items-center justify-center rounded-full bloom-volt"
              style={{ width: 54, height: 54, background: 'radial-gradient(circle at 45% 40%, #D8FF9A 0%, var(--ink-volt) 55%, #4FC414 100%)' }}
              initial={{ scale: 3, rotate: -30, opacity: 0, filter: 'blur(4px)' }}
              animate={{ scale: 1, rotate: 0, opacity: 1, filter: 'blur(0px)' }}
              transition={{ type: 'spring', stiffness: 480, damping: 15 }}>
              <PixelSprite sprite={SEAL_ICONS[seal ?? 'shield']} tint={INK.black} scale={3} />
            </motion.div>
          </div>
          <motion.div className="px-panel px-round px-[8px] py-[6px] flex flex-col items-center gap-[3px] w-full" data-popover
            style={{ boxShadow: '0 0 0 1px rgba(125,255,43,0.55), 0 0 14px 2px rgba(125,255,43,0.25)' }}
            initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
            <span className="glow-volt font-display" style={{ color: 'var(--ink-volt)', fontSize: 12 }}>
              {seal ? t.unlock_seal : t.unlock_collection}
            </span>
            {seal && <span className="text-title text-outline">{t[`seal_${seal}` as keyof Translations]}</span>}
            <span className="text-center leading-[11px]" style={{ color: 'var(--ink-mint)' }}>
              {seal ? `${t[`seal_${seal}_desc` as keyof Translations]} ${t.unlock_seal_desc}` : t.unlock_collection_desc}
            </span>
          </motion.div>
        </motion.button>
      )}
    </AnimatePresence>
  );
};
