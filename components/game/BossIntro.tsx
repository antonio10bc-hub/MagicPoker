import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { BOSSES, bossSeals } from '@/lib/bosses';
import { Translations, useTranslations } from '@/lib/i18n';
import { haptic, playSfx } from '@/lib/sounds';
import { INK } from '@/theme/tokens';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { HEART, SEAL_ICONS } from '@/components/pixel/sprites';
import { useStage } from '@/components/pixel/Stage';
import { BossFigure } from './BossFigure';
import { bossLine } from './BossTaunt';

// --- PRESENTACIÓN DEL JEFE ---
// Al empezar una partida nueva el jefe entra a pantalla completa: silueta grande que
// cae con un golpe, su nombre, sus vidas, sus sellos y su frase de entrada. Se va
// sola o al tocarla. En revancha y en el Castillo lleva su etiqueta.

const SHOW_MS = 2600;

export const BossIntro = () => {
  const t = useTranslations();
  const { width, height } = useStage();
  const { intro, bossIndex, level, castle, lives } = useGameStore(useShallow(s => ({
    intro: s.intro, bossIndex: s.bossIndex, level: s.rematchLevel, castle: !!s.castle, lives: s.opponent.lives,
  })));
  const [closed, setClosed] = useState<number | null>(null);
  const open = intro !== null && closed !== intro;

  useEffect(() => {
    if (intro === null) return;
    const slam = setTimeout(() => { playSfx('crush', 0.8, 0.7); playSfx('fight', 0.5); haptic('stamp'); }, 260);
    const done = setTimeout(() => setClosed(intro), SHOW_MS);
    return () => { clearTimeout(slam); clearTimeout(done); };
  }, [intro]);

  const boss = BOSSES[bossIndex];
  const seals = Array.from(new Set(bossSeals(boss, level)));
  const accent = castle ? 'var(--ink-crimson)' : level > 0 ? 'var(--ink-volt)' : 'var(--ink-orange)';
  const tag = castle ? t.castle_title : level > 0 ? t.rematch_level.replace('{n}', String(level)) : boss.secret ? t.secret_boss : null;
  const figureH = Math.min(150, Math.round(height * 0.32));

  return (
    <AnimatePresence>
      {open && (
        <motion.button
          key={intro}
          className="absolute inset-0 z-[150] flex flex-col items-center justify-center gap-[6px] cursor-pointer"
          style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(30,42,40,0.92) 0%, rgba(11,13,12,0.97) 70%)' }}
          onClick={() => setClosed(intro)}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.3 } }}
        >
          {tag && (
            <motion.span className="font-display" style={{ color: accent, fontSize: 11, textShadow: `0 0 6px ${accent}` }}
              initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>{tag}</motion.span>
          )}
          {/* La silueta cae y aplasta el suelo */}
          <motion.div style={{ transformOrigin: '50% 100%' }}
            initial={{ y: -height * 0.6, scaleY: 1.2 }} animate={{ y: 0, scaleY: [1.2, 0.85, 1.05, 1] }}
            transition={{ y: { type: 'spring', stiffness: 420, damping: 22 }, scaleY: { duration: 0.5, times: [0, 0.45, 0.75, 1], delay: 0.2 } }}>
            <BossFigure id={boss.id} height={figureH} evolved={castle} />
          </motion.div>
          <motion.div className="h-[3px] rounded-full" style={{ width: Math.min(160, width * 0.5), background: accent, boxShadow: `0 0 10px 2px ${accent}` }}
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.3, duration: 0.3 }} />
          <motion.span className="text-title text-outline" style={{ fontSize: 18 }}
            initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.35, type: 'spring', stiffness: 500, damping: 16 }}>
            {t[`boss_${boss.id}` as keyof Translations]}
          </motion.span>
          {/* Vidas y sellos */}
          <motion.div className="flex items-center gap-[6px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}>
            <span className="flex items-center gap-[2px]">
              <PixelSprite sprite={HEART} tint={INK.orange} className="bloom-shape" />
              <span className="font-display" style={{ color: 'var(--ink-cream)' }}>×{lives}</span>
            </span>
            {seals.slice(0, 10).map(s => (
              <PixelSprite key={s} sprite={SEAL_ICONS[s]} tint={INK.volt} className="bloom-volt-shape" />
            ))}
          </motion.div>
          <motion.span className="px-[8px] py-[4px] rounded-[4px] text-center leading-[11px]"
            style={{ background: 'var(--ink-cream)', color: 'var(--ink-black)', maxWidth: Math.min(220, width - 24) }}
            initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.8 }}>
            {bossLine(t, boss.id, 'intro', bossIndex)}
          </motion.span>
        </motion.button>
      )}
    </AnimatePresence>
  );
};
