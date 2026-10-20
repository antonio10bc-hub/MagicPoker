import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { BOSSES } from '@/lib/bosses';
import { Translations, useTranslations } from '@/lib/i18n';
import { playSfx } from '@/lib/sounds';
import { pausableTimeout } from '@/lib/clock';
import { useGameLayout } from '@/components/pixel/Stage';

// --- BOCADILLO DEL BOSS ---
// Al empezar cada ronda el boss suelta una frase con su personalidad: de entrada en la
// primera, otra si va perdiendo, otra si te tiene contra las cuerdas y, si no, una de
// las de siempre. Sale después del cartel de ronda, se va sola o al tocarla.

type Mood = 'intro' | 'mid' | 'low' | 'win';

const SHOW_DELAY_MS = 1100;
const SHOW_MS = 2800;

/** Frase de un boss para esta ronda (las variantes van separadas por "|") */
export const bossLine = (t: Translations, bossId: string, mood: Mood, round: number): string => {
  const lines = (t[`say_${bossId}_${mood}` as keyof Translations] ?? '').split('|');
  return lines[round % lines.length];
};

export const BossTaunt = () => {
  const t = useTranslations();
  const { rivalPanel: rect, compactPanels } = useGameLayout();
  const { round, placement, boss, bossLives, playerLives } = useGameStore(useShallow(s => ({
    round: s.roundNumber,
    placement: s.phase === 'placement',
    boss: s.tutorialStep === null ? BOSSES[s.bossIndex] : null,
    bossLives: s.opponent.lives,
    playerLives: s.player.lives,
  })));
  const [shown, setShown] = useState<{ round: number; text: string } | null>(null);

  // Una frase por ronda: se decide al empezarla
  useEffect(() => {
    if (!placement || !boss) return;
    // La frase de entrada ya la dice la presentación del jefe
    if (round === 1 && useGameStore.getState().intro !== null) return;
    const mood: Mood = round === 1 ? 'intro' : bossLives <= 2 ? 'low' : playerLives <= 2 ? 'win' : 'mid';
    const text = bossLine(t, boss.id, mood, round);
    const show = pausableTimeout(() => { setShown({ round, text }); playSfx('pop', 0.5, 0.8); }, SHOW_DELAY_MS);
    const hide = pausableTimeout(() => setShown(null), SHOW_DELAY_MS + SHOW_MS);
    return () => { show(); hide(); };
    // Solo al cambiar de ronda (las vidas se leen en ese momento)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, placement, boss?.id]);

  const w = 150;
  // Móvil: debajo de la barra del rival; horizontal: a la derecha de su panel
  const pos = compactPanels ? { left: rect.x + 4, top: rect.y + rect.h + 6 } : { left: rect.x + rect.w + 6, top: rect.y + 6 };
  return (
    <AnimatePresence>
      {shown && (
        <motion.button
          key={shown.round}
          className="absolute z-[90] text-left px-[6px] py-[4px] leading-[11px] cursor-pointer"
          style={{ ...pos, maxWidth: w, background: 'var(--ink-cream)', color: 'var(--ink-black)', borderRadius: 4,
            boxShadow: '0 0 0 1px var(--ink-black), 0 0 10px rgba(255,74,28,0.45)', transformOrigin: compactPanels ? '10% 0%' : '0% 30%' }}
          onClick={() => setShown(null)}
          initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.15 } }}
          transition={{ type: 'spring', stiffness: 520, damping: 20 }}
        >
          {/* Pico del bocadillo hacia el boss */}
          <span className="absolute" style={compactPanels
            ? { left: 10, top: -4, width: 8, height: 8, background: 'var(--ink-cream)', transform: 'rotate(45deg)' }
            : { left: -4, top: 8, width: 8, height: 8, background: 'var(--ink-cream)', transform: 'rotate(45deg)' }} />
          <span className="relative">{shown.text}</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
};

/** Espía: bocadillo con la carta de la mano del rival que has visto */
export const SpyBubble = () => {
  const t = useTranslations();
  const { rivalPanel: rect, compactPanels } = useGameLayout();
  const spy = useGameStore(s => s.spyFx);
  const [hidden, setHidden] = useState<number | null>(null);
  useEffect(() => {
    if (!spy) return;
    playSfx('sparkle');
    return pausableTimeout(() => setHidden(spy.id), 3200);
  }, [spy]);
  const show = spy && hidden !== spy.id;
  const name = spy ? (spy.rank === 'JOKER' ? 'Joker' : spy.rank === 'SEAL' ? t.seal_tag_wild : spy.rank) : '';
  const pos = compactPanels ? { left: rect.x + rect.w - 120, top: rect.y + rect.h + 6 } : { left: rect.x + rect.w + 6, top: rect.y + 36 };
  return (
    <AnimatePresence>
      {show && (
        <motion.div key={spy.id} className="absolute z-[90] px-[6px] py-[4px] rounded-[4px] pointer-events-none"
          style={{ ...pos, background: 'var(--ink-black)', color: 'var(--ink-cream)', boxShadow: '0 0 0 1px var(--ink-cream), 0 0 10px rgba(237,235,224,0.35)' }}
          initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
          {t.spy_saw.replace('{card}', name)}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
