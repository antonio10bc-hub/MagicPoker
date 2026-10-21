import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { BOSSES } from '@/lib/bosses';
import { Translations, useTranslations } from '@/lib/i18n';
import { haptic, playSfx, playSound } from '@/lib/sounds';
import { INK } from '@/theme/tokens';
import { PixelSprite, spriteSize } from '@/components/pixel/PixelSprite';
import { MERCHANT_SPRITE } from '@/components/pixel/bosses';
import { useStage } from '@/components/pixel/Stage';
import { pausableTimeout } from '@/lib/clock';
import { PxButton } from '@/components/pixel/ui';
import { BoonChooser } from './BoonChooser';
import { ChestReveal } from './ChestReveal';
import { CastleMap } from './CastleMap';
import { getCastle } from '@/lib/castle';
import { BossFigure } from './BossFigure';

// --- ENTRE PISOS DEL CASTILLO: JEFE DERROTADO Y EL MERCADER ---
// Pequeña cinemática en dos tiempos, sin cortes:
//  1. El jefe evolucionado tiembla, destella y se desmorona en esquirlas carmesí.
//  2. En la penumbra se enciende un farol y aparece el mercader (azul eléctrico). Dice
//     algo en voz baja y ofrece sus 3 mejoras; al elegir sube el siguiente jefe, que
//     evoluciona en su presentación. Se puede volver al menú: te esperará.
// Cada 3 pisos, entre los dos tiempos, un cofre por abrir. Tocar durante el primer
// tiempo lo salta.

const FALL_MS = 2200;

/** Silueta del mercader: cuerpo azul eléctrico, ojos y farol en crema */
export const MerchantFigure = ({ height }: { height: number }) => {
  const { width: w, height: h } = spriteSize(MERCHANT_SPRITE.body);
  const size = { width: (w * height) / h, height };
  return (
    <div className="relative shrink-0" style={size}>
      {/* Luz del farol, con parpadeo de llama */}
      <div className="absolute rounded-full anim-flicker pointer-events-none" style={{
        left: (-7 / w) * size.width, top: (15 / h) * height, width: (22 / w) * size.width, height: (22 / w) * size.width,
        background: 'radial-gradient(circle, rgba(237,235,224,0.5) 0%, rgba(46,155,255,0.3) 40%, transparent 70%)',
      }} />
      <PixelSprite sprite={MERCHANT_SPRITE.body} tint={INK.azure} className="bloom-azure-shape" style={{ position: 'absolute', inset: 0, ...size }} />
      <PixelSprite sprite={MERCHANT_SPRITE.seal} tint={INK.cream} className="bloom-cream" style={{ position: 'absolute', inset: 0, ...size }} />
    </div>
  );
};

/** Esquirlas del jefe al romperse (deterministas) */
const SHARDS = Array.from({ length: 14 }, (_, i) => ({
  x: ((i * 37) % 13 - 6) * 7,
  y: -((i * 53) % 9) * 6 - 10,
  size: i % 3 === 0 ? 3 : 2,
  rot: (i % 2 ? 1 : -1) * (90 + i * 20),
}));

/** Tiempo 1: el jefe derrotado se desmorona */
const BossFall = ({ bossId, floor, figureH }: { bossId: string; floor: number; figureH: number }) => {
  const t = useTranslations();
  return (
    <motion.div key="fall" className="absolute inset-0 flex flex-col items-center justify-center gap-[8px]"
      exit={{ opacity: 0, transition: { duration: 0.85 } }}>
      <div className="relative" style={{ height: figureH }}>
        {/* Tiembla, se enciende y se viene abajo */}
        <motion.div style={{ transformOrigin: '50% 100%' }}
          animate={{ x: [0, -3, 3, -3, 2, 0, 0], scaleY: [1, 1, 1, 1, 1, 1, 0.05], scaleX: [1, 1, 1, 1, 1, 1, 1.3], opacity: [1, 1, 1, 1, 1, 1, 0], filter: ['brightness(1)', 'brightness(1)', 'brightness(2.5)', 'brightness(1)', 'brightness(2.5)', 'brightness(1)', 'brightness(1)'] }}
          transition={{ duration: 1.7, times: [0, 0.1, 0.2, 0.3, 0.4, 0.55, 1], ease: 'easeIn' }}>
          <BossFigure id={bossId} height={figureH} evolved />
        </motion.div>
        {/* Esquirlas carmesí que saltan y caen */}
        {SHARDS.map((s, i) => (
          <motion.span key={i} className="absolute pointer-events-none" style={{ left: '50%', bottom: figureH * 0.3, width: s.size, height: s.size, background: 'var(--ink-crimson)', boxShadow: '0 0 3px rgba(255,31,75,0.9)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0], x: [0, s.x, s.x * 1.3], y: [0, s.y, s.y + 60], rotate: [0, s.rot] }}
            transition={{ duration: 1.5, delay: 0.85, times: [0, 0.1, 0.6, 1], ease: 'easeOut' }} />
        ))}
      </div>
      <motion.div className="flex flex-col items-center gap-[2px]" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.6 }}>
        <span className="font-display glow-crimson" style={{ color: 'var(--ink-crimson)', fontSize: 13, letterSpacing: 1 }}>{t.boss_defeated}</span>
        <span className="t-micro" style={{ color: 'var(--ink-mint)' }}>{t.merchant_floor.replace('{n}', String(floor))}</span>
      </motion.div>
    </motion.div>
  );
};

/** Tiempo 2: el mercader en la penumbra, con sus mejoras */
const Shop = ({ floor, figureH, panelW }: { floor: number; figureH: number; panelW: number }) => {
  const t = useTranslations();
  const exitToMenu = useGameStore(s => s.exitToMenu);
  // Al elegir, el mercader se desvanece en la oscuridad y sube el siguiente jefe
  const [leaving, setLeaving] = useState(false);
  const onChosen = () => {
    setLeaving(true);
    pausableTimeout(() => useGameStore.getState().startCastle(), 1050);
  };
  return (
    <motion.div key="shop" className="absolute inset-0 flex flex-col items-center justify-center gap-[5px]"
      style={{ pointerEvents: leaving ? 'none' : undefined }}
      initial={{ opacity: 0 }} animate={{ opacity: leaving ? 0 : 1 }} transition={{ duration: 1 }}>
      {/* Mapa de la subida: el piso recién vencido se rellena */}
      <motion.div className="mb-[8px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
        <CastleMap stage={floor} justCleared />
      </motion.div>
      {/* Primero se enciende el farol; luego, despacio, sale de la oscuridad */}
      <motion.div initial={{ opacity: 0, filter: 'brightness(0)' }} animate={{ opacity: [0, 0.35, 0.35, 1], filter: ['brightness(0)', 'brightness(0.2)', 'brightness(0.2)', 'brightness(1)'] }}
        transition={{ duration: 1.6, times: [0, 0.3, 0.55, 1] }}>
        <MerchantFigure height={figureH} />
      </motion.div>
      <motion.span className="font-display glow-azure" style={{ fontSize: 11, letterSpacing: 2, color: 'var(--ink-azure)' }}
        initial={{ opacity: 0, letterSpacing: '6px' }} animate={{ opacity: 1, letterSpacing: '2px' }} transition={{ delay: 1.2, duration: 1.1 }}>
        {t.merchant_name}
      </motion.span>
      {/* Habla en voz baja: sin bocadillo, entre comillas */}
      <motion.span className="t-micro text-center" style={{ color: 'var(--ink-mint)', maxWidth: panelW }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6, duration: 1 }}>
        «{t[`merchant_line_${floor % 4}` as keyof Translations]}»
      </motion.span>
      <div style={{ width: panelW }} className="mt-[6px]">
        <BoonChooser delay={1.9} compact onChosen={onChosen} />
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.3, duration: 0.5 }}>
        <PxButton size="sm" className="px-btn-ghost" onClick={() => { playSound('click'); exitToMenu(); }}>{t.exit_menu}</PxButton>
      </motion.div>
    </motion.div>
  );
};

type Step = 'fall' | 'chest' | 'shop';

export const MerchantScene = ({ floor }: { floor: number }) => {
  const { width, height } = useStage();
  const [step, setStep] = useState<Step>('fall');
  const shop = step === 'shop';
  const bossId = BOSSES[Math.max(0, floor - 1)].id;
  // Tras el jefe: el cofre (si es piso de cofre y aún está cerrado) y luego el mercader
  const afterFall = () => setStep(s => (s !== 'fall' ? s : getCastle().run?.chest ? 'chest' : 'shop'));

  useEffect(() => {
    const crack = setTimeout(() => { playSfx('crush', 0.7, 0.8); haptic('stamp'); }, 900);
    const open = setTimeout(afterFall, FALL_MS);
    return () => { clearTimeout(crack); clearTimeout(open); };
  }, []);
  useEffect(() => {
    if (!shop) return;
    const bell = setTimeout(() => playSfx('sparkle', 0.5, 0.7), 500);
    return () => clearTimeout(bell);
  }, [shop]);

  return (
    <motion.div
      className="absolute inset-0 z-[20]"
      onClick={() => { if (step === 'fall') afterFall(); }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9 }}
      // Del rojo del jefe al azul del mercader
      style={{ background: 'rgba(11,13,12,0.96)' }}
    >
      <motion.div className="absolute inset-0 pointer-events-none"
        animate={{ background: shop
          ? 'radial-gradient(ellipse 45% 30% at 50% 30%, rgba(18,60,110,0.5) 0%, rgba(11,13,12,0) 70%)'
          : step === 'chest' ? 'radial-gradient(ellipse 45% 30% at 50% 45%, rgba(90,60,14,0.4) 0%, rgba(11,13,12,0) 70%)'
            : 'radial-gradient(ellipse 45% 30% at 50% 40%, rgba(110,14,34,0.45) 0%, rgba(11,13,12,0) 70%)' }}
        transition={{ duration: 1.3 }} />
      <AnimatePresence mode="wait">
        {shop
          ? <Shop key="shop" floor={floor} figureH={Math.min(80, Math.round(height * 0.16))} panelW={Math.min(190, width - 32)} />
          : step === 'chest'
            ? <ChestReveal key="chest" width={Math.min(190, width - 32)} onDone={() => setStep('shop')} />
            : <BossFall key="fall" bossId={bossId} floor={floor} figureH={Math.min(110, Math.round(height * 0.22))} />}
      </AnimatePresence>
    </motion.div>
  );
};
