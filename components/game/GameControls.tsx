import { useEffect, useState } from 'react';
import { motion, AnimatePresence, TargetAndTransition } from 'framer-motion';
import { clsx } from 'clsx';
import { Info, Trophy } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useUiStore, ModalName } from '@/store/useUiStore';
import { useTranslations } from '@/lib/i18n';
import { playSound } from '@/lib/sounds';
import { COMBAT_REVEAL_SECONDS } from '@/lib/constants';

// --- CARTEL "TU TURNO" / "¡PELEA!" ---
export const TurnBanner = () => {
  const t = useTranslations();
  const { isFighting, isPlayerTurn } = useGameStore(useShallow(s => ({
    isFighting: s.phase === 'combat' || s.phase === 'combat-reveal',
    isPlayerTurn: s.turn === 'player',
  })));

  return (
    <div className="fixed top-28 sm:top-14 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      <div className={clsx(
        "px-4 py-1.5 sm:px-6 sm:py-2 rounded-md text-xl sm:text-2xl font-black tracking-wider transition-all shadow-[3px_3px_0_#000] sm:shadow-[6px_6px_0_#000] uppercase border-[3px] sm:border-[4px] border-black whitespace-nowrap relative -rotate-2",
        isFighting ? "bg-yellow-400 text-black animate-[wiggle_0.5s_infinite]" : isPlayerTurn ? "bg-[#8e0dff] text-white" : "bg-white text-[#ff590d]"
      )}>
        {isFighting ? t.fight : isPlayerTurn ? t.your_turn : t.rival_turn}
      </div>
    </div>
  );
};

// --- BOTÓN DE ACCIÓN (PLANTARSE / RESOLVER / CONTINUAR) ---
const actionButtonBase = "px-4 py-2 sm:px-6 sm:py-3 rounded-full font-black tracking-wider text-sm sm:text-base border-[3px] sm:border-[4px] border-black uppercase transition-all";
const actionButtonHover = "hover:-translate-y-1 hover:shadow-[6px_6px_0_#000] active:translate-y-1 active:shadow-[2px_2px_0_#000]";
const pulse: TargetAndTransition = { scale: [1, 1.05, 1], transition: { duration: 0.8, repeat: Infinity } };

/** Cuenta atrás que avanza sola al terminar. Se reinicia en cada montaje. */
const ContinueButton = () => {
  const t = useTranslations();
  const finishCombatPhase = useGameStore(s => s.finishCombatPhase);
  const [remaining, setRemaining] = useState(COMBAT_REVEAL_SECONDS);

  useEffect(() => {
    const timer = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (remaining === 0) finishCombatPhase();
  }, [remaining, finishCombatPhase]);

  const text = `${t.continue} (${remaining}s)`;
  return (
    <motion.button key={text} animate={pulse} onClick={finishCombatPhase} className={clsx(actionButtonBase, "bg-[#8e0dff] text-white border-black shadow-[4px_4px_0_#000]")}>
      {text}
    </motion.button>
  );
};

const PassButton = ({ opponentPassed }: { opponentPassed: boolean }) => {
  const t = useTranslations();
  const passTurn = useGameStore(s => s.passTurn);
  const text = opponentPassed ? t.resolve : t.stand;
  return (
    <motion.button key={text} onClick={passTurn} className={clsx(actionButtonBase, actionButtonHover, "text-white border-black", opponentPassed ? "bg-orange-500 hover:bg-orange-400" : "bg-green-500 hover:bg-green-400")}>
      {text}
    </motion.button>
  );
};

export const ActionButton = ({ canPlay }: { canPlay: boolean }) => {
  const { isReveal, opponentPassed } = useGameStore(useShallow(s => ({
    isReveal: s.phase === 'combat-reveal',
    opponentPassed: s.opponent.isPassed,
  })));

  return (
    <AnimatePresence>
      {(canPlay || isReveal) && (
        <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="fixed bottom-20 sm:bottom-32 right-4 z-50">
          {isReveal ? <ContinueButton /> : <PassButton opponentPassed={opponentPassed} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// --- BOTONES FLOTANTES (REGLAS / ESTADÍSTICAS) ---
const FLOATING_BUTTONS: { modal: ModalName; Icon: typeof Info; rotate: number }[] = [
  { modal: 'rules', Icon: Info, rotate: 5 },
  { modal: 'stats', Icon: Trophy, rotate: -5 },
];

export const FloatingButtons = () => {
  const openModal = useUiStore(s => s.openModal);
  return (
    <div className="fixed bottom-20 sm:bottom-32 left-4 z-50 flex flex-row gap-3">
      {FLOATING_BUTTONS.map(({ modal, Icon, rotate }) => (
        <motion.button
          key={modal}
          onClick={() => { playSound('click'); openModal(modal); }}
          whileHover={{ scale: 1.1, rotate }} whileTap={{ scale: 0.9 }}
          className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full border-[3px] border-black shadow-[3px_3px_0_#000] flex items-center justify-center hover:bg-yellow-100 transition-colors"
        >
          <Icon className="w-6 h-6 sm:w-8 sm:h-8 stroke-[3px]" />
        </motion.button>
      ))}
    </div>
  );
};
