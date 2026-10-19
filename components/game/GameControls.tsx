import { useEffect, useMemo, useState } from 'react';
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
import { Forecast, forecastFight } from './forecast';

// --- CUADRO DE ESTADO DEL TURNO ---
/** Puntos suspensivos animados mientras piensa el rival */
const ThinkingDots = () => (
  <span className="inline-flex ml-[2px]">
    {[0, 1, 2].map(i => (
      <span key={i} className="anim-dot" style={{ animationDelay: `${i * 0.12}s` }}>.</span>
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
      <WavyText text={`${t.round} ${round}`} className="text-title text-outline glow-text" style={{ color: 'var(--ink-orange)' }} />
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

/** Pronóstico visible: "-2 (+1 posible)" */
const ForecastLine = ({ label, f, tone }: { label: string; f: Forecast; tone: string }) => {
  const t = useTranslations();
  return (
    <div className="flex items-center justify-between gap-[6px]">
      <span>{label}</span>
      <span className="font-display whitespace-nowrap" style={{ color: tone, fontSize: 12 }}>
        {f.sure > 0 ? `-${f.sure}` : '0'}{f.maybe > 0 && <span style={{ color: 'var(--ink-teal)', fontSize: 10 }}> (+{f.maybe} {t.forecast_maybe})</span>}
      </span>
    </div>
  );
};

/**
 * Confirmación al plantarse: cuánto daño seguro haces y a cuánto te expones con lo
 * que se ve ahora mismo (las cartas ocultas del rival cuentan como posibles).
 */
const StandConfirm = ({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) => {
  const t = useTranslations();
  const { width } = useStage();
  const { actionButton: r } = useGameLayout();
  const { playerBoard, opponentBoard, opponentPassed } = useGameStore(useShallow(s => ({
    playerBoard: s.player.board, opponentBoard: s.opponent.board, opponentPassed: s.opponent.isPassed,
  })));
  const { dealt, taken } = useMemo(() => forecastFight(playerBoard, opponentBoard), [playerBoard, opponentBoard]);
  const w = Math.min(170, width - 8);
  const left = Math.max(4, Math.min(r.x + r.w - w, width - 4 - w));
  return (
    <>
      {/* Tocar fuera cancela */}
      <div className="absolute inset-0 z-[84]" onClick={onCancel} />
      <motion.div
        className="px-panel px-round absolute z-[85] p-[6px] flex flex-col gap-[4px] leading-[11px]"
        style={{ left, top: r.y - 6, width: w, translateY: '-100%' }}
        initial={{ opacity: 0, y: 8, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, transition: { duration: 0.12 } }}
        transition={{ type: 'spring', stiffness: 500, damping: 26 }}
      >
        <div className="text-title glow-text" style={{ color: 'var(--ink-orange)' }}>{t.stand_confirm}</div>
        <ForecastLine label={t.forecast_dealt} f={dealt} tone="var(--ink-orange)" />
        <ForecastLine label={t.forecast_taken} f={taken} tone="var(--ink-cream)" />
        {!opponentPassed && <div style={{ color: 'var(--ink-teal)' }}>{t.forecast_open}</div>}
        <div className="flex gap-[4px] mt-[2px]">
          <PxButton onClick={onCancel} className="flex-1 h-[16px]">{t.keep_playing}</PxButton>
          <PxButton tone="green" onClick={onConfirm} className="flex-1 h-[16px]"><span className="text-outline">{opponentPassed ? t.resolve : t.stand}</span></PxButton>
        </div>
      </motion.div>
    </>
  );
};

const PassButton = ({ opponentPassed, onPress }: { opponentPassed: boolean; onPress: () => void }) => {
  const t = useTranslations();
  return (
    <PxButton tone={opponentPassed ? 'roof' : 'green'} onClick={() => { playSfx('open', 0.6); onPress(); }} className="w-full h-full anim-breathe">
      <span className="text-outline">{opponentPassed ? t.resolve : t.stand}</span>
    </PxButton>
  );
};

export const ActionButton = ({ canPlay }: { canPlay: boolean }) => {
  const { actionButton: r } = useGameLayout();
  const { isReveal, opponentPassed, passTurn } = useGameStore(useShallow(s => ({
    isReveal: s.phase === 'combat-reveal',
    opponentPassed: s.opponent.isPassed,
    passTurn: s.passTurn,
  })));
  const [confirming, setConfirming] = useState(false);
  const showConfirm = confirming && canPlay;

  return (
    <>
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
            {isReveal ? <ContinueButton /> : <PassButton opponentPassed={opponentPassed} onPress={() => setConfirming(true)} />}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showConfirm && (
          <StandConfirm key="confirm" onCancel={() => { playSfx('deselect', 0.6); setConfirming(false); }}
            onConfirm={() => { setConfirming(false); passTurn(); }} />
        )}
      </AnimatePresence>
    </>
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
