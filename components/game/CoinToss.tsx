import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useUiStore } from '@/store/useUiStore';
import { BOSSES } from '@/lib/bosses';
import { useTranslations } from '@/lib/i18n';
import { haptic, playSfx } from '@/lib/sounds';
import { INK } from '@/theme/tokens';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { HEART } from '@/components/pixel/sprites';
import { BossFigure } from './BossFigure';
import { ForestFigure } from './ForestFigure';

// --- CARA O CRUZ ---
// Al empezar una partida (tras la presentación del jefe) se lanza una moneda en el
// centro, con la mesa detrás desenfocada: cara (crema, tu corazón) empiezas tú; cruz
// (naranja, la silueta del rival) empieza él. Sube girando, cae, se lee el resultado y
// arranca la primera ronda (sola o al tocar).

const SIZE = 64;
const SPIN_S = 1.5;
/** Vueltas completas antes de caer */
const TURNS = 5;
/** Tras caer, lo que se queda el resultado a la vista */
const HOLD_MS = 1200;
/** Sin cinemáticas durante este rato: ya se puede lanzar */
const CALM_MS = 350;

const Face = ({ heads, back }: { heads: boolean; back?: boolean }) => {
  const { boss, forest } = useGameStore(useShallow(s => ({
    boss: s.forest ? null : BOSSES[s.bossIndex], forest: s.forest,
  })));
  const ink = heads ? 'var(--ink-cream)' : 'var(--ink-orange)';
  return (
    <div className="absolute inset-0 rounded-full flex items-center justify-center"
      style={{
        backfaceVisibility: 'hidden', transform: back ? 'rotateY(180deg)' : undefined,
        background: `radial-gradient(circle at 38% 32%, ${heads ? '#FFFDF2' : 'var(--ink-ember)'} 0%, ${ink} 45%, ${heads ? 'var(--ink-mint)' : '#C2300E'} 100%)`,
        boxShadow: heads
          ? 'inset 0 0 0 3px rgba(11,13,12,0.85), inset 0 0 0 5px rgba(237,235,224,0.6), 0 0 14px 3px rgba(237,235,224,0.35)'
          : 'inset 0 0 0 3px rgba(11,13,12,0.85), inset 0 0 0 5px rgba(255,74,28,0.6), 0 0 14px 3px rgba(255,74,28,0.55)',
      }}>
      {heads
        ? <PixelSprite sprite={HEART} tint={INK.black} scale={3} />
        : forest ? <ForestFigure id={forest.id} tier={forest.tier} height={34} mode="shadow" />
        : boss ? <BossFigure id={boss.id} height={34} dark glow={false} />
        : <span className="text-title text-ink">{'?'}</span>}
    </div>
  );
};

export const CoinToss = () => {
  const t = useTranslations();
  const coin = useGameStore(s => (s.phase === 'start' ? s.coin : null));
  // Espera a que se vaya la presentación del jefe (que se marca un instante después de
  // montarse: por eso la calma tiene que durar un poco antes de lanzar)
  const cinematic = useUiStore(s => s.cinematic);
  const [calm, setCalm] = useState<number | null>(null);
  useEffect(() => {
    if (!coin || cinematic) return;
    const t = setTimeout(() => setCalm(coin.id), CALM_MS);
    return () => clearTimeout(t);
  }, [coin, cinematic]);
  const show = !!coin && !cinematic && calm === coin.id;
  const [landed, setLanded] = useState<number | null>(null);
  const heads = coin?.opener === 'player';
  const done = !!coin && landed === coin.id;

  useEffect(() => {
    if (!show || !coin) return;
    playSfx('whoosh', 0.8, 1.2);
    const flips = Array.from({ length: TURNS }, (_, i) => setTimeout(() => playSfx('flip', 0.35, 1 + i * 0.06), 150 + i * (SPIN_S * 1000 - 300) / TURNS));
    const land = setTimeout(() => {
      setLanded(coin.id);
      playSfx('crush', 0.6, 1.3);
      playSfx(coin.opener === 'player' ? 'sparkle' : 'pop', 0.7);
      haptic('stamp');
    }, SPIN_S * 1000);
    return () => { flips.forEach(clearTimeout); clearTimeout(land); };
  }, [show, coin]);

  // Tras leer el resultado, empieza la ronda
  useEffect(() => {
    if (!done) return;
    const go = setTimeout(() => useGameStore.getState().beginMatch(), HOLD_MS);
    return () => clearTimeout(go);
  }, [done]);

  return (
    <AnimatePresence>
      {show && coin && (
        <motion.button key={coin.id} type="button" aria-label="coin toss"
          className="absolute inset-0 z-[150] flex flex-col items-center justify-center gap-[10px] cursor-pointer"
          style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(30,42,40,0.55) 0%, rgba(11,13,12,0.8) 75%)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
          onClick={() => { if (done) useGameStore.getState().beginMatch(); }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.3 } }}>
          <motion.span className="text-title text-outline glow-text" style={{ color: 'var(--ink-cream)' }}
            initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            {t.coin_title}
          </motion.span>
          {/* La moneda: sube girando sobre su eje y cae mostrando el resultado */}
          <div style={{ perspective: 300, height: SIZE + 40, display: 'flex', alignItems: 'flex-end' }}>
            <motion.div className="relative" style={{ width: SIZE, height: SIZE, transformStyle: 'preserve-3d' }}
              initial={{ y: 0, rotateY: 0, scale: 0.9 }}
              animate={{
                y: [0, -46, 0, -6, 0],
                rotateY: TURNS * 360 + (heads ? 0 : 180),
                scale: [0.9, 1.25, 1, 1.04, 1],
              }}
              transition={{
                y: { duration: SPIN_S, times: [0, 0.45, 0.85, 0.93, 1], ease: 'easeInOut' },
                rotateY: { duration: SPIN_S * 0.85, ease: [0.2, 0.6, 0.4, 1] },
                scale: { duration: SPIN_S, times: [0, 0.45, 0.85, 0.93, 1] },
              }}>
              <Face heads />
              <Face heads={false} back />
            </motion.div>
          </div>
          {/* Sombra en el suelo: se encoge cuando la moneda sube */}
          <motion.div className="rounded-full -mt-[8px]" style={{ width: SIZE * 0.8, height: 5, background: 'rgba(0,0,0,0.55)' }}
            animate={{ scaleX: [1, 0.5, 1, 0.9, 1], opacity: [0.8, 0.3, 0.8, 0.7, 0.8] }}
            transition={{ duration: SPIN_S, times: [0, 0.45, 0.85, 0.93, 1] }} />
          <div className="h-[34px] flex flex-col items-center gap-[3px]">
            {done ? (
              <>
                <motion.span className="text-title text-outline" style={{ fontSize: 22, lineHeight: '20px', color: heads ? 'var(--ink-cream)' : 'var(--ink-orange)' }}
                  initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 16 }}>
                  {heads ? t.coin_heads : t.coin_tails}
                </motion.span>
                <motion.span style={{ color: heads ? 'var(--ink-mint)' : 'var(--ink-ember)' }}
                  initial={{ y: 4, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
                  {heads ? t.coin_you_start : t.coin_rival_starts}
                </motion.span>
              </>
            ) : (
              <span className="t-note">{t.coin_rule}</span>
            )}
          </div>
        </motion.button>
      )}
    </AnimatePresence>
  );
};
