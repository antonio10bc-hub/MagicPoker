import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { Translations, useTranslations } from '@/lib/i18n';
import { playSfx, playSound } from '@/lib/sounds';
import { INK } from '@/theme/tokens';
import { PixelSprite, spriteSize } from '@/components/pixel/PixelSprite';
import { MERCHANT_SPRITE } from '@/components/pixel/bosses';
import { useStage } from '@/components/pixel/Stage';
import { PxButton } from '@/components/pixel/ui';
import { BoonChooser } from './BoonChooser';

// --- EL MERCADER DEL CASTILLO ---
// Tras vencer a un jefe del Castillo la pantalla se oscurece y entra el mercader, en
// azul eléctrico, con su farol. Te dice algo y te ofrece sus 3 mejoras; al elegir una
// sube el siguiente jefe (con su presentación). Puedes irte al menú: te esperará.

/** Silueta del mercader: cuerpo azul eléctrico, ojos y farol en crema */
export const MerchantFigure = ({ height }: { height: number }) => {
  const { width: w, height: h } = spriteSize(MERCHANT_SPRITE.body);
  const size = { width: (w * height) / h, height };
  return (
    <div className="relative shrink-0" style={size}>
      {/* Luz del farol: late despacio */}
      <div className="absolute rounded-full anim-pulse pointer-events-none" style={{
        left: (-6 / w) * size.width, top: (16 / h) * height, width: (20 / w) * size.width, height: (20 / w) * size.width,
        background: 'radial-gradient(circle, rgba(237,235,224,0.55) 0%, rgba(46,155,255,0.35) 40%, transparent 70%)',
      }} />
      <PixelSprite sprite={MERCHANT_SPRITE.body} tint={INK.azure} className="bloom-azure-shape" style={{ position: 'absolute', inset: 0, ...size }} />
      <PixelSprite sprite={MERCHANT_SPRITE.seal} tint={INK.cream} className="bloom-cream" style={{ position: 'absolute', inset: 0, ...size }} />
    </div>
  );
};

export const MerchantScene = ({ floor }: { floor: number }) => {
  const t = useTranslations();
  const { width, height } = useStage();
  const exitToMenu = useGameStore(s => s.exitToMenu);
  const figureH = Math.min(120, Math.round(height * 0.24));
  const panelW = Math.min(220, width - 24);

  useEffect(() => {
    const steps = setTimeout(() => playSfx('whoosh', 0.6, 0.8), 150);
    const bell = setTimeout(() => playSfx('sparkle', 0.7, 0.8), 650);
    return () => { clearTimeout(steps); clearTimeout(bell); };
  }, []);

  return (
    <motion.div
      className="absolute inset-0 z-[20] flex flex-col items-center justify-center gap-[6px]"
      style={{ background: 'radial-gradient(ellipse 60% 45% at 50% 34%, rgba(18,60,110,0.55) 0%, rgba(11,13,12,0.96) 70%)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
    >
      <motion.span className="font-display glow-crimson" style={{ color: 'var(--ink-crimson)', fontSize: 11 }}
        initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
        {t.merchant_floor.replace('{n}', String(floor))}
      </motion.span>
      {/* Entra caminando desde la derecha, con un leve vaivén */}
      <motion.div
        initial={{ x: width * 0.6, opacity: 0 }} animate={{ x: 0, opacity: 1, y: [0, -2, 0, -2, 0] }}
        transition={{ x: { duration: 0.7, ease: 'easeOut', delay: 0.2 }, opacity: { duration: 0.3, delay: 0.2 }, y: { duration: 0.7, delay: 0.2 } }}>
        <MerchantFigure height={figureH} />
      </motion.div>
      <motion.div className="h-[3px] rounded-full" style={{ width: Math.min(160, width * 0.5), background: 'var(--ink-azure)', boxShadow: '0 0 10px 2px rgba(46,155,255,0.8)' }}
        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.75, duration: 0.3 }} />
      <motion.span className="text-title glow-azure" style={{ fontSize: 18, color: 'var(--ink-azure)' }}
        initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.8, type: 'spring', stiffness: 500, damping: 16 }}>
        {t.merchant_name}
      </motion.span>
      <motion.span className="px-[8px] py-[4px] rounded-[4px] text-center leading-[11px]"
        style={{ background: 'var(--ink-cream)', color: 'var(--ink-black)', maxWidth: panelW }}
        initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1 }}>
        {t[`merchant_line_${floor % 4}` as keyof Translations]}
      </motion.span>
      <div style={{ width: panelW }} className="mt-[4px]">
        <BoonChooser delay={1.2} />
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }} style={{ width: Math.min(140, panelW) }}>
        <PxButton size="sm" className="w-full px-btn-ghost" onClick={() => { playSound('click'); exitToMenu(); }}>{t.exit_menu}</PxButton>
      </motion.div>
    </motion.div>
  );
};
