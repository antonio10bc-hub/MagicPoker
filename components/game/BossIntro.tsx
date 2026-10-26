import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useUiStore } from '@/store/useUiStore';
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
// sola o al tocarla. En revancha y en el Castillo lleva su etiqueta. En el Castillo
// cae en su forma normal y ahí mismo evoluciona: destello carmesí, sacudida y le sale
// su capa roja. Ahí no se va sola: se queda hasta que tocas (sin aviso en pantalla).

const SHOW_MS = 2600;
const EVOLVE_S = 0.85;
/** En el Castillo, los toques antes de que termine de evolucionar no cuentan */
const CASTLE_TAP_AFTER_MS = (EVOLVE_S + 0.95) * 1000;

/** Brasas carmesí que suben alrededor del jefe al evolucionar (deterministas) */
const EMBERS = Array.from({ length: 12 }, (_, i) => ({
  // Por los lados de la silueta, no encima
  x: i % 2 ? -0.18 + ((i * 41) % 30) / 100 : 0.88 + ((i * 41) % 30) / 100,
  delay: EVOLVE_S + 0.3 + ((i * 29) % 10) / 12,
  rise: 30 + ((i * 17) % 5) * 8,
  size: i % 3 === 0 ? 3 : 2,
}));

export const BossIntro = () => {
  const t = useTranslations();
  const { width, height } = useStage();
  const { intro, bossIndex, level, castle, lives } = useGameStore(useShallow(s => ({
    intro: s.intro, bossIndex: s.bossIndex, level: s.rematchLevel, castle: !!s.castle, lives: s.opponent.lives,
  })));
  const [closed, setClosed] = useState<number | null>(null);
  const open = intro !== null && closed !== intro;
  // Mientras se ve, los avisos (logros) y el cara o cruz esperan. Solo se marca estando
  // abierta: cerrada no toca la marca (si no, pisaría la de otra cinemática en curso)
  useEffect(() => {
    if (!open) return;
    useUiStore.getState().setCinematic(true);
    return () => useUiStore.getState().setCinematic(false);
  }, [open]);

  useEffect(() => {
    if (intro === null) return;
    const slam = setTimeout(() => { playSfx('crush', 0.8, 0.7); playSfx('fight', 0.5); haptic('stamp'); }, 260);
    const evolve = castle ? setTimeout(() => { playSfx('zap', 0.8, 0.6); haptic('stamp'); }, (EVOLVE_S + 0.2) * 1000) : undefined;
    const done = castle ? undefined : setTimeout(() => setClosed(intro), SHOW_MS);
    return () => { clearTimeout(slam); clearTimeout(evolve); clearTimeout(done); };
  }, [intro, castle]);

  const boss = BOSSES[bossIndex];
  const royal = castle && boss.id === 'sovereign';
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
          aria-label="boss intro"
          onClick={() => { if (!castle || Date.now() - intro >= CASTLE_TAP_AFTER_MS) setClosed(intro); }}
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
            {castle ? (
              // Evoluciona: la forma normal tiembla y encima se enciende la evolucionada
              <motion.div className="relative"
                animate={{ x: [0, 0, -3, 3, -2, 2, 0], scale: [1, 1, 1.18, 1, 1, 1, 1], filter: ['brightness(1)', 'brightness(1)', 'brightness(3)', 'brightness(1.4)', 'brightness(1)', 'brightness(1)', 'brightness(1)'] }}
                transition={{ duration: 1.05, delay: EVOLVE_S - 0.15, times: [0, 0.25, 0.35, 0.55, 0.7, 0.85, 1] }}>
                <BossFigure id={boss.id} height={figureH} />
                <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: EVOLVE_S + 0.2, duration: 0.65 }}>
                  <BossFigure id={boss.id} height={figureH} evolved />
                </motion.div>
                {/* Destello carmesí al evolucionar */}
                <motion.div className="absolute rounded-full pointer-events-none" style={{ left: '50%', top: '45%', width: figureH * 1.4, height: figureH * 1.4, marginLeft: -figureH * 0.7, marginTop: -figureH * 0.7,
                  background: 'radial-gradient(circle, rgba(255,31,75,0.85) 0%, rgba(255,31,75,0.35) 35%, transparent 65%)' }}
                  initial={{ opacity: 0, scale: 0.3 }} animate={{ opacity: [0, 1, 0], scale: [0.3, 1.3, 1.6] }} transition={{ delay: EVOLVE_S + 0.2, duration: 1.2 }} />
                {/* Onda de choque: un anillo carmesí que se abre */}
                <motion.div className="absolute rounded-full pointer-events-none" style={{ left: '50%', top: '50%', width: figureH, height: figureH, marginLeft: -figureH / 2, marginTop: -figureH / 2,
                  boxShadow: '0 0 0 2px rgba(255,31,75,0.9), 0 0 10px 2px rgba(255,31,75,0.6)' }}
                  initial={{ opacity: 0, scale: 0.2 }} animate={{ opacity: [0, 1, 0], scale: [0.2, 1.2, 1.8] }} transition={{ delay: EVOLVE_S + 0.25, duration: 1.1, ease: 'easeOut' }} />
                {/* Brasas que suben y siguen saliendo mientras dura la presentación */}
                {EMBERS.map((e, i) => (
                  <motion.span key={i} className="absolute pointer-events-none" style={{ left: `${e.x * 100}%`, bottom: '10%', width: e.size, height: e.size,
                      // El Soberano: la mitad, de oro
                      background: royal && i % 2 ? 'var(--ink-gold)' : 'var(--ink-crimson)', boxShadow: royal && i % 2 ? '0 0 3px rgba(232,182,74,0.95)' : '0 0 3px rgba(255,31,75,0.9)' }}
                    initial={{ opacity: 0, y: 0 }} animate={{ opacity: [0, 1, 0], y: [0, -e.rise] }}
                    transition={{ duration: 1.6, delay: e.delay, repeat: Infinity, repeatDelay: 0.3, ease: 'easeOut' }} />
                ))}
              </motion.div>
            ) : <BossFigure id={boss.id} height={figureH} />}
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
