import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useTranslations } from '@/lib/i18n';
import { playSfx, playSound } from '@/lib/sounds';
import { markTutorialDone, stepCard, TUTORIAL_STEPS, TutorialStep } from '@/lib/tutorial';
import { useGameLayout } from '@/components/pixel/Stage';
import { PxButton } from '@/components/pixel/ui';
import { CARD_SIZE } from '@/theme/tokens';

// --- TUTORIAL: qué se puede hacer ahora ---

export interface TutorialGate {
  active: boolean;
  step: TutorialStep | undefined;
  /** Única carta de la mano que se puede jugar (paso "play") */
  cardId: string | undefined;
  /** Único hueco válido (paso "play") */
  slot: number | undefined;
}

export const useTutorialGate = (): TutorialGate => {
  const { stepIndex, hand } = useGameStore(useShallow(s => ({ stepIndex: s.tutorialStep, hand: s.player.hand })));
  const step = stepIndex !== null ? TUTORIAL_STEPS[stepIndex] : undefined;
  return {
    active: stepIndex !== null,
    step,
    cardId: stepCard(hand, step)?.id,
    slot: step?.kind === 'play' ? step.slot : undefined,
  };
};

/** Ancho medio de un carácter de la tipografía de máquina de escribir, en em */
const CHAR_EM = 0.6;

/** Tamaño de letra (10, 9 u 8 px) para que el texto quepa en `maxH` px de alto */
const fitFont = (text: string, textW: number, maxH: number) => {
  for (const f of [10, 9, 8]) {
    const lines = Math.ceil((text.length * f * CHAR_EM) / textW);
    if (lines * f + 4 <= maxH) return f;
  }
  return 8;
};

/**
 * El "entrenador". Dónde se coloca depende del paso, para no tapar nunca lo que importa:
 * Siempre el mismo sitio: un cartel compacto sobre la franja central (entre las dos
 * filas), que se lee bien. Los repasos de pelea y las explicaciones esperan a
 * "Continuar", con el botón a la derecha del texto. La letra baja a 9 u 8 px si el texto
 * es largo, para caber entre las filas.
 */
export const TutorialCoach = () => {
  const t = useTranslations();
  const { board } = useGameLayout();
  const { stepIndex, phase, finish, next, exit } = useGameStore(useShallow(s => ({
    stepIndex: s.tutorialStep, phase: s.phase, finish: s.finishCombatPhase, next: s.nextTutorialNote, exit: s.exitToMenu,
  })));
  if (stepIndex === null || phase === 'end') return null;
  const step = TUTORIAL_STEPS[stepIndex];
  if (!step) return null;
  // Los repasos solo se ven con el resultado de la pelea a la vista
  if (step.kind === 'review' && phase !== 'combat-reveal') return null;
  if (step.kind !== 'review' && phase !== 'placement') return null;

  // Repasos y explicaciones: cartel grande abajo que espera a "Continuar"
  const blocking = step.kind === 'review' || step.kind === 'note';
  const text = t[step.text];
  const d = board.diorama;
  const panelW = d.w - 8;
  // Siempre en el centro, entre las dos filas (se lee mejor): el mayor tamaño de letra que
  // cabe en el hueco; los que esperan a "Continuar" llevan el botón a la derecha
  const gap = board.slots.player[0].y - (board.slots.opponent[0].y + CARD_SIZE.height);
  // Sitio que se reserva para el botón al calcular la letra
  const BTN_W = 62;
  const font = fitFont(text, panelW - 12 - (blocking ? BTN_W + 4 : 0), gap + 4);
  const place = { left: d.x + 4, width: panelW, top: board.centerLine.y + board.centerLine.h / 2, translateY: '-50%' };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepIndex}
        className={clsx('px-panel px-round absolute z-[82] flex leading-[10px]', blocking ? 'flex-row items-center gap-[4px]' : 'flex-col')}
        data-popover
        style={{ ...place, padding: '2px 6px', boxShadow: '0 0 0 1px rgba(255,74,28,0.55), 0 0 14px 2px rgba(255,74,28,0.25)' }}
        initial={{ opacity: 0, scale: 0.9, filter: 'blur(3px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.12 } }}
        transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      >
        {/* Saltar: pestaña encima del cartel (no ocupa sitio dentro), con el paso por el que vas */}
        <button className="absolute cursor-pointer px-[4px] rounded-t-[3px]" data-skip
          style={{ right: 6, top: -10, height: 10, fontSize: 8, lineHeight: '10px', color: 'var(--ink-teal)', background: 'rgba(11,13,12,0.95)' }}
          onClick={() => { playSound('click'); markTutorialDone(); exit(); }}>{stepIndex + 1}/{TUTORIAL_STEPS.length} · {t.tut_skip}</button>
        <span className={clsx('text-outline', blocking && 'flex-1')} style={{ fontSize: font, lineHeight: `${font}px` }}>{text}</span>
        {blocking && (
          <PxButton tone="green" className="h-[15px] shrink-0 px-[5px]" data-coach-next
            onClick={() => { playSfx('select', 0.7); if (step.kind === 'note') next(); else finish(); }}>
            <span className="text-outline">{t.continue}</span>
          </PxButton>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
