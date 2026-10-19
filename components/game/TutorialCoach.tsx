import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useTranslations } from '@/lib/i18n';
import { playSfx, playSound } from '@/lib/sounds';
import { markTutorialDone, stepCard, TUTORIAL_STEPS, TutorialStep } from '@/lib/tutorial';
import { useGameLayout, useStage } from '@/components/pixel/Stage';
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
 *  · jugar / plantarse: cartel compacto sobre la franja central (entre las dos filas);
 *  · repasos de pelea: abajo, sobre la mano (que entonces no se usa), con el tablero
 *    entero a la vista; esperan a "Continuar".
 * El texto del cartel central baja a 9 px si es largo, para caber entre las filas.
 */
export const TutorialCoach = () => {
  const t = useTranslations();
  const { width, height } = useStage();
  const { board, hand } = useGameLayout();
  const { stepIndex, phase, finish, exit } = useGameStore(useShallow(s => ({
    stepIndex: s.tutorialStep, phase: s.phase, finish: s.finishCombatPhase, exit: s.exitToMenu,
  })));
  if (stepIndex === null || phase === 'end') return null;
  const step = TUTORIAL_STEPS[stepIndex];
  if (!step) return null;
  // Los repasos solo se ven con el resultado de la pelea a la vista
  if (step.kind === 'review' && phase !== 'combat-reveal') return null;
  if (step.kind !== 'review' && phase !== 'placement') return null;

  const blocking = step.kind === 'review';
  const text = t[step.text];
  const d = board.diorama;
  const panelW = blocking ? Math.min(width - 8, hand.w) : d.w - 8;
  // Cartel central: el mayor tamaño de letra cuyas líneas caben en el hueco entre filas
  const gap = board.slots.player[0].y - (board.slots.opponent[0].y + CARD_SIZE.height);
  const font = blocking ? 10 : fitFont(text, panelW - 12, gap + 4);
  const place = blocking
    ? { left: Math.max(4, hand.x), width: panelW, top: height - 4, translateY: '-100%' }
    : { left: d.x + 4, width: panelW, top: board.centerLine.y + board.centerLine.h / 2, translateY: '-50%' };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepIndex}
        className={blocking ? 'px-panel px-round absolute z-[82] flex flex-col gap-[4px] leading-[11px]' : 'px-panel px-round absolute z-[82] flex flex-col leading-[10px]'}
        data-popover
        style={{ ...place, padding: blocking ? 6 : '2px 6px', boxShadow: '0 0 0 1px rgba(255,74,28,0.55), 0 0 14px 2px rgba(255,74,28,0.25)' }}
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
        {/* Saltar: pestaña encima del cartel central (no ocupa sitio dentro) */}
        {!blocking && (
          <button className="absolute cursor-pointer px-[4px] rounded-t-[3px]" data-skip
            style={{ right: 6, top: -10, height: 10, fontSize: 8, lineHeight: '10px', color: 'var(--ink-teal)', background: 'rgba(11,13,12,0.95)' }}
            onClick={() => { playSound('click'); markTutorialDone(); exit(); }}>{t.tut_skip}</button>
        )}
        <span className="text-outline" style={{ fontSize: font, lineHeight: `${font}px` }}>{text}</span>
        {blocking && (
          <div className="flex justify-end">
            <PxButton tone="green" className="h-[15px] px-[8px]" data-coach-next
              onClick={() => { playSfx('select', 0.7); finish(); }}>
              <span className="text-outline">{t.continue}</span>
            </PxButton>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
