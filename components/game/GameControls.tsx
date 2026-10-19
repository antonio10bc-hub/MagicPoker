import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useUiStore } from '@/store/useUiStore';
import { useTranslations } from '@/lib/i18n';
import { playSound } from '@/lib/sounds';
import { isBoardEmpty } from '@/lib/game-utils';
import { COMBAT_REVEAL_SECONDS } from '@/lib/constants';
import { steps } from '@/theme/tokens';
import { IconButton, PxButton, TextBox } from '@/components/pixel/ui';
import { ICONS } from '@/components/pixel/sprites';

const RIGHT_COLUMN = { x: 314, w: 66 };

// --- CUADRO DE ESTADO DEL TURNO (arriba a la derecha) ---
export const TurnBox = () => {
  const t = useTranslations();
  const { isFighting, isPlayerTurn } = useGameStore(useShallow(s => ({
    isFighting: s.phase === 'combat' || s.phase === 'combat-reveal',
    isPlayerTurn: s.turn === 'player',
  })));
  const text = isFighting ? t.fight : isPlayerTurn ? t.your_turn : t.rival_turn;
  return (
    <TextBox
      text={text}
      className="absolute"
      style={{ left: RIGHT_COLUMN.x, top: 4, width: RIGHT_COLUMN.w, minHeight: 36, color: isFighting ? 'var(--c-red)' : isPlayerTurn ? 'var(--c-green-dark)' : 'var(--c-navy)' }}
    />
  );
};

// --- BOTÓN DE ACCIÓN (PLANTARSE / RESOLVER / CONTINUAR) ---
const buttonBox = { left: RIGHT_COLUMN.x, top: 196, width: RIGHT_COLUMN.w, height: 22 };

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

  return (
    <PxButton tone="blue" onClick={finishCombatPhase} className="w-full h-full gap-[3px]">
      <span className="text-outline">{t.continue}</span>
      <span className="text-outline">{remaining}</span>
    </PxButton>
  );
};

const PassButton = ({ opponentPassed }: { opponentPassed: boolean }) => {
  const t = useTranslations();
  const passTurn = useGameStore(s => s.passTurn);
  return (
    <PxButton tone={opponentPassed ? 'roof' : 'green'} onClick={passTurn} className="w-full h-full">
      <span className="text-outline">{opponentPassed ? t.resolve : t.stand}</span>
    </PxButton>
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
        <motion.div
          key={isReveal ? 'continue' : 'pass'}
          className="absolute z-50"
          style={buttonBox}
          initial={{ x: 72 }}
          animate={{ x: 0 }}
          exit={{ x: 72 }}
          transition={{ duration: 0.12, ease: steps(4) }}
        >
          {isReveal ? <ContinueButton /> : <PassButton opponentPassed={opponentPassed} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// --- BOTONES DE MENÚ (inicio, reglas, estadísticas) ---
export const MenuButtons = () => {
  const openModal = useUiStore(s => s.openModal);

  const handleHome = () => {
    playSound('click');
    // Solo pedimos confirmación si ya hay progreso en la partida
    const { roundNumber, player, exitToMenu } = useGameStore.getState();
    if (roundNumber > 1 || !isBoardEmpty(player.board)) openModal('exit');
    else exitToMenu();
  };

  return (
    <div className="absolute flex gap-[3px]" style={{ left: 4, top: 70 }}>
      <IconButton icon={ICONS.home} onClick={handleHome} aria-label="home" />
      <IconButton icon={ICONS.info} onClick={() => { playSound('click'); openModal('rules'); }} aria-label="rules" />
      <IconButton icon={ICONS.trophy} onClick={() => { playSound('click'); openModal('stats'); }} aria-label="stats" />
    </div>
  );
};
