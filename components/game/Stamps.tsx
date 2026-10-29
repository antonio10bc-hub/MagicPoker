import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { useUiStore } from '@/store/useUiStore';
import { useTranslations, Translations } from '@/lib/i18n';
import { haptic, playSfx } from '@/lib/sounds';
import { StampId } from '@/lib/stamps';
import { INK } from '@/theme/tokens';
import { PixelSprite, Sprite } from '@/components/pixel/PixelSprite';
import { ALERT, BURST, CHARACTERS, CROSS, FLAME, HEART, MASK, HEART_LOST, ICONS, PIP, SEAL_ICONS, STAR } from '@/components/pixel/sprites';
import { useStage } from '@/components/pixel/Stage';

// --- SELLOS ---
// Un sello es un círculo de tinta con un icono en silueta: conseguido, una masa
// naranja que brilla; por conseguir, un anillo pizarra apagado.

const ICON: Record<StampId, Sprite> = {
  first_win: ICONS.trophy,
  republicana: CHARACTERS.A!,
  immolation: FLAME,
  flawless: HEART,
  comeback: HEART_LOST,
  massacre: BURST,
  barrage: CHARACTERS.K!,
  lightning: STAR,
  hard_win: ALERT,
  streak3: CHARACTERS.Q!,
  full_court: CHARACTERS.JOKER!,
  stalemate: CROSS,
  veteran: CHARACTERS.J!,
  bulwark: SEAL_ICONS.shield,
  heist: SEAL_ICONS.swap,
  purist: CROSS,
  reflex: SEAL_ICONS.mirror,
  venom: SEAL_ICONS.poison,
  rematch: SEAL_ICONS.double,
  collector: SEAL_ICONS.anchor,
  castle: CHARACTERS.TOWER!,
  ch_noHeal: HEART_LOST,
  ch_fierce: BURST,
  ch_sealed: SEAL_ICONS.echo,
  ch_short: PIP,
  ch_fragile: HEART,
  nightmare: SEAL_ICONS.reveal,
  bestiary: MASK,
};

export const stampName = (t: Translations, id: StampId) => t[`stamp_${id}` as keyof Translations];
export const stampDesc = (t: Translations, id: StampId) => t[`stamp_${id}_desc` as keyof Translations];

export const StampSeal = ({ id, earned, size = 30, tilt = -8 }: { id: StampId; earned: boolean; size?: number; tilt?: number }) => {
  const scale = size >= 48 ? 2 : 1;
  return (
    <div className="relative flex items-center justify-center rounded-full shrink-0" style={{
      width: size, height: size, transform: `rotate(${tilt}deg)`,
      background: earned ? 'radial-gradient(circle at 45% 40%, var(--ink-ember) 0%, var(--ink-orange) 70%)' : 'rgba(30,42,40,0.6)',
      boxShadow: earned
        ? '0 0 6px 1px rgba(255,74,28,0.55), inset 0 0 0 2px rgba(11,13,12,0.55), inset 0 0 0 4px rgba(255,74,28,0.9), inset 0 0 0 5px rgba(11,13,12,0.45)'
        : 'inset 0 0 0 1px rgba(94,122,118,0.6), inset 0 0 0 3px transparent, inset 0 0 0 4px rgba(94,122,118,0.3)',
    }}>
      <div style={{ opacity: earned ? 1 : 0.35 }}>
        <PixelSprite sprite={ICON[id]} tint={earned ? INK.black : INK.teal} scale={scale} />
      </div>
    </div>
  );
};

/**
 * Celebración de un sello nuevo: se estampa de golpe en el centro, con un anillo de
 * tinta, y se va solo (o al tocarlo). Espera a que termine el choque de la pelea para
 * no tapar la acción.
 */
/** Pequeña pausa antes de cada sello para no pisar la salida del aviso anterior */
const ENTER_DELAY_MS = 300;

export const StampToasts = () => {
  const t = useTranslations();
  const { width, height } = useStage();
  const current = useUiStore(s => s.stampQueue[0]);
  const shift = useUiStore(s => s.shiftStamp);
  // Espera a que termine la pelea (también el repaso del resultado) para no taparla
  const busy = useGameStore(s => s.phase === 'combat' || s.phase === 'combat-reveal');
  // Con una ventana abierta, el aviso espera a que se cierre
  const modalOpen = useUiStore(s => !!s.modal || s.cinematic);
  // El premio del boss (sello o colección) se celebra antes
  const unlockPending = useUiStore(s => s.unlockQueue.length > 0);
  const ready = current && !busy && !unlockPending && !modalOpen;
  const [shown, setShown] = useState<StampId | null>(null);
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => setShown(current), ENTER_DELAY_MS);
    return () => clearTimeout(id);
  }, [ready, current]);
  const show = ready && shown === current;

  useEffect(() => {
    if (!show) return;
    const slam = setTimeout(() => { playSfx('crush', 0.7, 1.2); playSfx('sparkle'); haptic('stamp'); }, 180);
    const done = setTimeout(shift, 2300);
    return () => { clearTimeout(slam); clearTimeout(done); };
  }, [show, current, shift]);

  const w = Math.min(210, width - 16);
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          key={current}
          className="absolute z-[300] flex flex-col items-center gap-[6px] cursor-pointer"
          style={{ left: (width - w) / 2, top: Math.round(height * 0.24), width: w }}
          onClick={shift}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -12, transition: { duration: 0.25 } }}
        >
          <div className="relative">
            {/* Anillo de tinta que salpica al estampar */}
            <motion.div className="absolute rounded-full" style={{ inset: -6, boxShadow: '0 0 0 2px rgba(255,74,28,0.7), 0 0 14px 4px rgba(255,74,28,0.35)' }}
              initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: [0.6, 1.5], opacity: [0, 1, 0] }} transition={{ duration: 0.6, delay: 0.18 }} />
            <motion.div
              initial={{ scale: 3, rotate: -40, opacity: 0, filter: 'blur(4px)' }}
              animate={{ scale: 1, rotate: 0, opacity: 1, filter: 'blur(0px)' }}
              transition={{ type: 'spring', stiffness: 520, damping: 16 }}
            >
              <StampSeal id={current} earned size={56} tilt={-10} />
            </motion.div>
          </div>
          <motion.div className="px-panel px-round px-[8px] py-[5px] flex flex-col items-center gap-[3px] w-full" data-popover
            initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
            <span className="glow-text" style={{ color: 'var(--ink-orange)' }}>{t.new_stamp}</span>
            <span className="text-title text-outline">{stampName(t, current)}</span>
            <span className="text-center leading-[11px]" style={{ color: 'var(--ink-mint)' }}>{stampDesc(t, current)}</span>
          </motion.div>
        </motion.button>
      )}
    </AnimatePresence>
  );
};
