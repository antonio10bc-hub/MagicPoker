import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useTranslations } from '@/lib/i18n';
import { playSfx, playSound } from '@/lib/sounds';
import { markTutorialDone, stepCard, TUTORIAL_STEPS, TutorialStep } from '@/lib/tutorial';
import { useGameLayout, useStage } from '@/components/pixel/Stage';
import { PxButton } from '@/components/pixel/ui';

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

/**
 * El "entrenador". Dónde se coloca depende del paso, para no tapar nunca lo que importa:
 *  · jugar / plantarse: cartel compacto sobre la franja central (entre las dos filas);
 *  · explicaciones y repasos de pelea: abajo, sobre la mano (que entonces no se usa),
 *    con el tablero entero a la vista. Esperan a "Entendido" / "Continuar".
 */
export const TutorialCoach = () => {
  const t = useTranslations();
  const { width, height } = useStage();
  const { board, hand } = useGameLayout();
  const { stepIndex, phase, advance, finish, exit } = useGameStore(useShallow(s => ({
    stepIndex: s.tutorialStep, phase: s.phase, advance: s.advanceTutorial, finish: s.finishCombatPhase, exit: s.exitToMenu,
  })));
  if (stepIndex === null || phase === 'end') return null;
  const step = TUTORIAL_STEPS[stepIndex];
  if (!step) return null;
  // Los repasos solo se ven con el resultado de la pelea a la vista
  if (step.kind === 'review' && phase !== 'combat-reveal') return null;
  if (step.kind !== 'review' && phase !== 'placement') return null;

  const blocking = step.kind === 'info' || step.kind === 'review';
  const d = board.diorama;
  const place = blocking
    ? { left: Math.max(4, hand.x), width: Math.min(width - 8, hand.w), top: height - 4, translateY: '-100%' }
    : { left: d.x + 4, width: d.w - 8, top: board.centerLine.y + board.centerLine.h / 2, translateY: '-50%' };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepIndex}
        className={blocking ? 'px-panel px-round absolute z-[82] flex flex-col gap-[4px] leading-[11px]' : 'px-panel px-round absolute z-[82] flex flex-col leading-[10px]'}
        data-popover
        style={{ ...place, padding: blocking ? 6 : '3px 6px', boxShadow: '0 0 0 1px rgba(255,74,28,0.55), 0 0 14px 2px rgba(255,74,28,0.25)' }}
        initial={{ opacity: 0, scale: 0.9, filter: 'blur(3px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.12 } }}
        transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      >
        {blocking && (
          <div className="flex items-start justify-between gap-[6px]">
            <span className="font-display glow-text" style={{ color: 'var(--ink-orange)', fontSize: 11 }}>{t.tutorial} · {stepIndex + 1}/{TUTORIAL_STEPS.length}</span>
            <button className="cursor-pointer" style={{ color: 'var(--ink-teal)' }} data-skip
              onClick={() => { playSound('click'); markTutorialDone(); exit(); }}>{t.tut_skip}</button>
          </div>
        )}
        <span className="text-outline">{t[step.text]}</span>
        {blocking && (
          <div className="flex justify-end">
            <PxButton tone="green" className="h-[15px] px-[8px]" data-coach-next
              onClick={() => { playSfx('select', 0.7); if (step.kind === 'review') finish(); else advance(); }}>
              <span className="text-outline">{step.kind === 'review' ? t.continue : t.tut_ok}</span>
            </PxButton>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
