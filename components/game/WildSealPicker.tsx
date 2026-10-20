import { motion } from 'framer-motion';
import { SealId } from '@/types';
import { ALL_SEALS } from '@/lib/bosses';
import { Translations, useTranslations } from '@/lib/i18n';
import { playSfx } from '@/lib/sounds';
import { INK } from '@/theme/tokens';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { SEAL_ICONS } from '@/components/pixel/sprites';
import { useStage } from '@/components/pixel/Stage';

// --- COMODÍN DE SELLO ---
// Al soltar el comodín sobre una carta propia se elige qué sello es (cualquiera).
export const WildSealPicker = ({ onPick, onCancel }: { onPick: (seal: SealId) => void; onCancel: () => void }) => {
  const t = useTranslations();
  const { width } = useStage();
  const w = Math.min(220, width - 16);
  return (
    <motion.div className="absolute inset-0 z-[160] flex items-center justify-center" style={{ background: 'rgba(11,13,12,0.75)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onCancel}>
      <motion.div className="px-panel px-round p-[6px] flex flex-col gap-[5px]" style={{ width: w, boxShadow: '0 0 0 1px rgba(125,255,43,0.55)' }}
        initial={{ scale: 0.7 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()}>
        <span className="glow-volt text-center" style={{ color: 'var(--ink-volt)' }}>{t.wild_pick}</span>
        <div className="grid grid-cols-5 gap-[4px] justify-items-center">
          {ALL_SEALS.map(seal => (
            <button key={seal} aria-label={`wild ${seal}`} className="flex flex-col items-center gap-[1px] cursor-pointer"
              onClick={() => { playSfx('sparkle'); onPick(seal); }}>
              <span className="flex items-center justify-center rounded-full bloom-volt" style={{ width: 22, height: 22, background: 'var(--ink-volt)' }}>
                <PixelSprite sprite={SEAL_ICONS[seal]} tint={INK.black} />
              </span>
              <span style={{ fontSize: 7, lineHeight: '8px', color: 'var(--ink-mint)' }}>{t[`seal_tag_${seal}` as keyof Translations]}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};
