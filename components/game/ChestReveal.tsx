import { useState } from 'react';
import { motion } from 'framer-motion';
import { Boon, boonRarity, getCastle, openChest, Rarity } from '@/lib/castle';
import { useTranslations } from '@/lib/i18n';
import { haptic, playSfx, playSound } from '@/lib/sounds';
import { pausableTimeout } from '@/lib/clock';
import { track } from '@/lib/analytics';
import { INK } from '@/theme/tokens';
import { PixelSprite, spriteSize } from '@/components/pixel/PixelSprite';
import { CHEST } from '@/components/pixel/chest';
import { PxButton } from '@/components/pixel/ui';
import { BoonIcon, boonText, RARITY_UI } from './BoonChooser';

// --- COFRE DEL CASTILLO (cada 3 pisos) ---
// Un pequeño gacha: el cofre espera cerrado y latiendo; al tocarlo tiembla cada vez
// más y su luz pasa por los colores de rareza (menta → azul → oro) hasta pararse en la
// suya. Entonces la tapa salta, sale un haz de ese color y sube el premio.

const GLOW: Record<Rarity, string> = { common: '185,207,200', rare: '46,155,255', legendary: '232,182,74' };
const ORDER: Rarity[] = ['common', 'rare', 'legendary'];
const SHAKE_S = 1.6;

const ChestSprite = ({ scale, lidOpen }: { scale: number; lidOpen: boolean }) => {
  const lid = spriteSize(CHEST.lid.wood);
  const body = spriteSize(CHEST.body.wood);
  const w = lid.width * scale;
  const layer = (part: { wood: typeof CHEST.lid.wood; trim: typeof CHEST.lid.trim }, h: number) => (
    <>
      <PixelSprite sprite={part.wood} tint={INK.crimson} style={{ position: 'absolute', inset: 0, width: w, height: h }} />
      <PixelSprite sprite={part.trim} tint={INK.gold} className="bloom-gold-shape" style={{ position: 'absolute', inset: 0, width: w, height: h }} />
    </>
  );
  return (
    <div className="relative" style={{ width: w, height: (lid.height + body.height) * scale }}>
      <motion.div className="absolute left-0 top-0" style={{ width: w, height: lid.height * scale, transformOrigin: '10% 100%' }}
        animate={lidOpen ? { y: -scale * 9, rotate: -28, opacity: [1, 1, 0.9] } : { y: 0, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 14 }}>
        {layer(CHEST.lid, lid.height * scale)}
      </motion.div>
      <div className="absolute left-0" style={{ top: lid.height * scale, width: w, height: body.height * scale }}>
        {layer(CHEST.body, body.height * scale)}
      </div>
    </div>
  );
};

export const ChestReveal = ({ onDone, width }: { onDone: () => void; width: number }) => {
  const t = useTranslations();
  // El premio ya está decidido en la subida; se lee al aparecer
  const [prize] = useState<Boon | undefined>(() => getCastle().run?.chest);
  const [deck] = useState(() => getCastle().run?.deck ?? []);
  const [step, setStep] = useState<'closed' | 'shaking' | 'open'>('closed');
  const rarity = prize ? boonRarity(prize) : 'common';
  const ui = RARITY_UI[rarity];
  // La luz sube de rareza en rareza hasta la que toca
  const ladder = ORDER.slice(0, ORDER.indexOf(rarity) + 1);
  const scale = Math.min(4, Math.floor(width / 40));

  const open = () => {
    if (step !== 'closed' || !prize) return;
    setStep('shaking');
    playSound('click');
    ladder.forEach((_, i) => pausableTimeout(() => { playSfx('tick', 0.8, 1 + i * 0.3); haptic('stamp'); }, (i + 1) * (SHAKE_S * 1000) / (ladder.length + 1)));
    track('chest_opened', { kind: prize.kind, rarity, card: prize.kind === 'card' ? prize.rank : null, seal: prize.kind === 'seal' ? prize.seal : null, floor: getCastle().run?.stage ?? null });
    pausableTimeout(() => {
      openChest();
      setStep('open');
      playSfx('sparkle', 1, rarity === 'legendary' ? 0.8 : 1.1);
      playSfx('crush', 0.5, 1.4);
      haptic('win');
    }, SHAKE_S * 1000);
  };

  const text = prize ? boonText(t, prize, deck) : null;
  const glow = (r: Rarity, a: number) => `radial-gradient(circle, rgba(${GLOW[r]},${a}) 0%, rgba(${GLOW[r]},${a * 0.35}) 35%, transparent 68%)`;

  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-[8px] cursor-pointer"
      onClick={e => { e.stopPropagation(); open(); }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.85 } }} transition={{ duration: 0.9 }}>
      <span className="font-display glow-crimson" style={{ color: 'var(--ink-crimson)', fontSize: 11, letterSpacing: 2 }}>{t.chest_title}</span>
      <div className="relative flex items-center justify-center" style={{ width: 22 * scale * 2, height: 14 * scale * 2.2 }}>
        {/* Luz de detrás: tenue cerrada; en el temblor pasa por las rarezas; abierta, la suya */}
        <motion.div className="absolute inset-0 rounded-full pointer-events-none"
          style={{ background: glow('common', 0.25) }}
          animate={step === 'closed' ? { opacity: [0.5, 1, 0.5] }
            : step === 'shaking' ? { background: ladder.map(r => glow(r, 0.6)), scale: [1, 1.15, 1.3] }
              : { background: glow(rarity, 0.85), scale: 1.5, opacity: 1 }}
          transition={step === 'closed' ? { duration: 1.8, repeat: Infinity } : { duration: step === 'shaking' ? SHAKE_S : 0.5 }} />
        {/* Haz de luz al abrirse */}
        {step === 'open' && (
          <motion.div className="absolute pointer-events-none" style={{ bottom: '40%', width: 22 * scale * 0.7, height: 160,
            background: `linear-gradient(to top, rgba(${GLOW[rarity]},0.7), transparent)`, filter: 'blur(2px)' }}
            initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: [0, 1, 0.6] }} transition={{ duration: 1, ease: 'easeOut' }} />
        )}
        {/* El cofre: late cerrado, tiembla cada vez más y se abre */}
        <motion.div
          animate={step === 'closed' ? { y: [0, -2, 0], rotate: 0 }
            : step === 'shaking' ? { rotate: [0, -3, 3, -5, 5, -8, 8, -10, 10, 0], y: [0, -1, 0, -2, 0, -3, 0, -4, 0, 0] }
              : { rotate: 0, y: 0, scale: [1.15, 1] }}
          transition={step === 'closed' ? { duration: 1.4, repeat: Infinity } : { duration: step === 'shaking' ? SHAKE_S : 0.5 }}>
          <ChestSprite scale={scale} lidOpen={step === 'open'} />
        </motion.div>
        {/* El premio sube desde dentro */}
        {step === 'open' && prize && (
          <motion.div className="absolute flex items-center justify-center" style={{ transformOrigin: '50% 50%' }}
            initial={{ y: 0, scale: 0.4, opacity: 0 }} animate={{ y: -14 * scale, scale: 2.2, opacity: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 14 }}>
            <BoonIcon boon={prize} />
          </motion.div>
        )}
      </div>
      {step === 'open' && text ? (
        <motion.div className="flex flex-col items-center gap-[3px] text-center" style={{ maxWidth: width }}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.6 }}>
          <span className="font-display" style={{ color: ui.color, fontSize: 9, letterSpacing: 2, textShadow: `0 0 6px rgba(${GLOW[rarity]},0.9)` }}>{t[ui.label]}</span>
          <span style={{ color: rarity === 'legendary' ? 'var(--ink-gold)' : 'var(--ink-cream)' }}>{text.title}</span>
          <span className="t-micro" style={{ color: 'var(--ink-mint)' }}>{text.desc}</span>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 0.5 }} className="mt-[4px]">
            <PxButton size="sm" tone="roof" onClick={e => { e.stopPropagation(); playSound('click'); onDone(); }}>{t.chest_continue}</PxButton>
          </motion.div>
        </motion.div>
      ) : (
        <motion.span className="t-micro" style={{ color: 'var(--ink-mint)' }} animate={{ opacity: step === 'closed' ? [0.4, 1, 0.4] : 0 }}
          transition={{ duration: 1.8, repeat: step === 'closed' ? Infinity : 0 }}>{t.chest_tap}</motion.span>
      )}
    </motion.div>
  );
};
