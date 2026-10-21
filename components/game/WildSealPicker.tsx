import { SealId } from '@/types';
import { ALL_SEALS } from '@/lib/bosses';
import { Translations, useTranslations } from '@/lib/i18n';
import { playSfx } from '@/lib/sounds';
import { INK } from '@/theme/tokens';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { SEAL_ICONS } from '@/components/pixel/sprites';
import { Dialog, DialogBody } from '@/components/modals/Dialog';

// --- COMODÍN DE SELLO ---
// Al soltar el comodín sobre una carta propia se elige qué sello es (cualquiera).
export const WildSealPicker = ({ onPick, onCancel }: { onPick: (seal: SealId) => void; onCancel: () => void }) => {
  const t = useTranslations();
  return (
    <Dialog title={t.wild_pick} size="md" onClose={onCancel}>
      <DialogBody scroll={false}>
        <div className="grid grid-cols-5 gap-x-[3px] gap-y-[6px] justify-items-center">
          {ALL_SEALS.map(seal => (
            <button key={seal} aria-label={`wild ${seal}`} className="flex flex-col items-center gap-[2px] cursor-pointer"
              onClick={() => { playSfx('sparkle'); onPick(seal); }}>
              <span className="flex items-center justify-center rounded-full bloom-volt" style={{ width: 22, height: 22, background: 'var(--ink-volt)' }}>
                <PixelSprite sprite={SEAL_ICONS[seal]} tint={INK.black} />
              </span>
              <span className="t-micro" style={{ color: 'var(--ink-mint)' }}>{t[`seal_tag_${seal}` as keyof Translations]}</span>
            </button>
          ))}
        </div>
      </DialogBody>
    </Dialog>
  );
};
