import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useUiStore } from '@/store/useUiStore';
import { useTranslations } from '@/lib/i18n';
import { playSfx, playSound } from '@/lib/sounds';
import { isBoardEmpty } from '@/lib/game-utils';
import { COMBAT_REVEAL_SECONDS } from '@/lib/constants';
import { IconButton, PxButton, TextBox, WavyText } from '@/components/pixel/ui';
import { useGameLayout, useStage } from '@/components/pixel/Stage';
import { ICONS } from '@/components/pixel/sprites';

// --- CUADRO DE ESTADO DEL TURNO ---
/** Puntos suspensivos animados mientras piensa el rival */
const ThinkingDots = () => (
  <span className="inline-flex ml-[2px]">
    {[0, 1, 2].map(i => (
      <motion.span key={i} animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }}>.</motion.span>
    ))}
  </span>
);

export const TurnBox = () => {
  const t = useTranslations();
  const { isFighting, isPlayerTurn } = useGameStore(useShallow(s => ({
    isFighting: s.phase === 'combat' || s.phase === 'combat-reveal',
    isPlayerTurn: s.turn === 'player',
  })));
  const { turnBox: box, compactPanels } = useGameLayout();
  const round = useGameStore(s => s.roundNumber);
  const rivalThinking = !isFighting && !isPlayerTurn;
  const text = isFighting ? t.fight : isPlayerTurn ? t.your_turn : t.rival_turn.replace(/\.+$/, '');
  return (
    <motion.div
      key={text}
      className="absolute"
      style={{ left: box.x, top: box.y, width: box.w }}
      initial={{ scale: 0.9, y: -4 }}
      animate={{ scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 16 }}
    >
      <TextBox
        text={text}
        style={{ minHeight: box.h, color: isFighting ? 'var(--c-mult)' : isPlayerTurn ? 'var(--c-green-light)' : 'var(--c-cyan)' }}
        suffix={rivalThinking ? <ThinkingDots /> : undefined}
        compact={compactPanels}
      />
      {/* En vertical no hay barra lateral: la ronda va en una ficha dentro del cuadro */}
      {compactPanels && (
        <div className="absolute px-round text-ink font-display flex items-center px-[4px] pt-[2px]"
          style={{ right: 3, top: 2, height: 12, background: 'var(--ink-orange)', boxShadow: '0 0 6px 1px rgba(255,74,28,0.5)' }}>
          {t.round.charAt(0)}{round}
        </div>
      )}
    </motion.div>
  );
};

// --- CARTEL DE RONDA ---
/** Barre la pantalla al empezar cada ronda. Se monta con key={ronda}. */
const RoundBanner = ({ round }: { round: number }) => {
  const t = useTranslations();
  const { width } = useStage();
  // Pasa sobre la franja central del tablero, entre las dos filas de cartas
  const { board } = useGameLayout();
  useEffect(() => {
    const id = setTimeout(() => playSfx('turn'), 120);
    return () => clearTimeout(id);
  }, []);
  return (
    <motion.div
      className="absolute left-0 z-[80] pointer-events-none flex items-center justify-center gap-[8px]"
      style={{ top: board.centerLine.y + Math.round(board.centerLine.h / 2) - 13, width, height: 26, background: 'var(--c-ui-panel)',
        boxShadow: '0 0 12px 3px rgba(255,74,28,0.3), inset 0 1px 6px rgba(255,74,28,0.35)' }}
      // Ghosting: borroso mientras barre, nítido mientras se lee
      initial={{ x: -width, skewX: -20, filter: 'blur(3px)' }}
      animate={{ x: [-width, 0, 0, width], skewX: [-20, 0, 0, 20], filter: ['blur(3px)', 'blur(0px)', 'blur(0px)', 'blur(3px)'] }}
      transition={{ duration: 1.1, times: [0, 0.22, 0.72, 1], ease: 'easeInOut' }}
    >
      <WavyText text={`${t.round} ${round}`} className="text-title text-outline bloom" style={{ color: 'var(--ink-orange)' }} />
      <WavyText text={t.your_turn} className="text-outline" style={{ color: 'var(--c-cyan)' }} />
    </motion.div>
  );
};

export const RoundAnnouncer = () => {
  const { round, phase } = useGameStore(useShallow(s => ({ round: s.roundNumber, phase: s.phase })));
  return phase === 'placement' ? <RoundBanner key={round} round={round} /> : null;
};

// --- BOTÓN DE ACCIÓN (PLANTARSE / RESOLVER / CONTINUAR) ---
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
    else if (remaining < COMBAT_REVEAL_SECONDS) playSfx('hover', 0.6, 0.7);
  }, [remaining, finishCombatPhase]);

  return (
    <PxButton tone="blue" onClick={finishCombatPhase} className="w-full h-full gap-[3px]">
      <span className="text-outline">{t.continue}</span>
      <motion.span key={remaining} className="text-outline" initial={{ scale: 1.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 14 }}>
        {remaining}
      </motion.span>
    </PxButton>
  );
};

const PassButton = ({ opponentPassed }: { opponentPassed: boolean }) => {
  const t = useTranslations();
  const passTurn = useGameStore(s => s.passTurn);
  return (
    <PxButton tone={opponentPassed ? 'roof' : 'green'} onClick={passTurn} className="w-full h-full anim-breathe">
      <span className="text-outline">{opponentPassed ? t.resolve : t.stand}</span>
    </PxButton>
  );
};

export const ActionButton = ({ canPlay }: { canPlay: boolean }) => {
  const { actionButton: r } = useGameLayout();
  const { isReveal, opponentPassed } = useGameStore(useShallow(s => ({
    isReveal: s.phase === 'combat-reveal',
    opponentPassed: s.opponent.isPassed,
  })));

  return (
    <AnimatePresence mode="wait">
      {(canPlay || isReveal) && (
        <motion.div
          key={isReveal ? 'continue' : 'pass'}
          className="absolute z-50"
          style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
          initial={{ x: 40, scale: 0.6, opacity: 0, rotate: 8 }}
          animate={{ x: 0, scale: 1, opacity: 1, rotate: 0 }}
          exit={{ x: 40, scale: 0.6, opacity: 0, transition: { duration: 0.12 } }}
          transition={{ type: 'spring', stiffness: 420, damping: 18 }}
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
  const { menuButtons: pos } = useGameLayout();

  const handleHome = () => {
    playSound('click');
    // Solo pedimos confirmación si ya hay progreso en la partida
    const { roundNumber, player, exitToMenu } = useGameStore.getState();
    if (roundNumber > 1 || !isBoardEmpty(player.board)) openModal('exit');
    else exitToMenu();
  };

  return (
    <div className="absolute flex gap-[3px]" style={{ left: pos.x, top: pos.y }}>
      <IconButton icon={ICONS.home} onClick={handleHome} aria-label="home" />
      <IconButton icon={ICONS.info} onClick={() => { playSound('click'); openModal('rules'); }} aria-label="rules" />
      <IconButton icon={ICONS.trophy} onClick={() => { playSound('click'); openModal('stats'); }} aria-label="stats" />
    </div>
  );
};
