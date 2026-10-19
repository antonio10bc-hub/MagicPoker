import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useTranslations, Translations } from '@/lib/i18n';
import { haptic, playSfx, playSound } from '@/lib/sounds';
import { useEffect } from 'react';
import { GameResult } from '@/types';
import { PALETTE } from '@/theme/tokens';
import { useMenuLayout, useStage } from '@/components/pixel/Stage';
import { Panel, PxButton } from '@/components/pixel/ui';
import { Mascot, MenuBackground } from './MenuScreen';

const RESULT_UI: Record<GameResult, { title: keyof Translations; sub: keyof Translations; band: string }> = {
  // Victoria: recompensa (naranja que brilla); empate: niebla; derrota: silueta
  win: { title: 'win', sub: 'win_sub', band: 'var(--ink-orange)' },
  draw: { title: 'draw', sub: 'draw_sub', band: 'var(--ink-teal)' },
  loss: { title: 'loss', sub: 'loss_sub', band: 'var(--ink-slate)' },
};

// --- CONFETI EN PÍXEL (determinista, sin Math.random en el render) ---
/** Polvo granulado que cae, no confeti de colores */
const CONFETTI_COLORS = [PALETTE.white, PALETTE.white, PALETTE.cyan, PALETTE.red, PALETTE.roof];
const CONFETTI = Array.from({ length: 36 }, (_, i) => ({
  /** Posición horizontal como fracción del ancho */
  fx: ((i * 97) % 384) / 384,
  delay: ((i * 37) % 100) / 60,
  duration: 1.6 + ((i * 53) % 10) / 10,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  size: i % 3 === 0 ? 3 : 2,
}));

const Confetti = () => {
  const { width, height } = useStage();
  return (
    <>
      {CONFETTI.map((c, i) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none z-[5]"
          style={{ left: Math.floor(c.fx * width), top: -4, width: c.size, height: c.size, background: c.color, borderRadius: '50%', boxShadow: `0 0 3px ${c.color}` }}
          animate={{ y: [0, height + 8], x: [0, 6, -6, 4, 0], rotate: [0, 360 * (i % 2 ? 1 : -1)] }}
          transition={{ duration: c.duration, delay: c.delay, repeat: 2, ease: 'linear' }}
        />
      ))}
    </>
  );
};

/** Rayos de luz girando detrás del panel (victoria) */
const Rays = ({ x, y }: { x: number; y: number }) => (
  <motion.div
    className="absolute pointer-events-none z-[5] rounded-full"
    style={{ left: x - 160, top: y - 160, width: 320, height: 320,
      maskImage: 'radial-gradient(circle, black 30%, transparent 70%)', WebkitMaskImage: 'radial-gradient(circle, black 30%, transparent 70%)' }}
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ scale: { type: 'spring', stiffness: 120, damping: 14, delay: 0.3 }, opacity: { duration: 0.4 } }}
  >
    {/* Giro continuo en CSS (compositor) */}
    <div className="absolute inset-0 rounded-full anim-spin"
      style={{ background: 'repeating-conic-gradient(rgba(255, 74, 28, 0.22) 0deg 12deg, transparent 12deg 30deg)' }} />
  </motion.div>
);

/** Título que aparece letra a letra con rebote */
const TitleLetters = ({ text }: { text: string }) => (
  <span className="inline-flex">
    {text.split('').map((ch, i) => (
      <motion.span key={i} style={{ display: 'inline-block', whiteSpace: 'pre' }}
        initial={{ y: -10, scale: 0, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 600, damping: 12, delay: 0.5 + i * 0.04 }}>
        {ch}
      </motion.span>
    ))}
  </span>
);

export const EndScreen = () => {
  const t = useTranslations();
  const { gameResult, startGame, exitToMenu } = useGameStore(useShallow(s => ({
    gameResult: s.gameResult ?? 'loss',
    startGame: s.startGame,
    exitToMenu: s.exitToMenu,
  })));
  const ui = RESULT_UI[gameResult];
  const { cx, board, playY } = useMenuLayout();
  const panelWidth = Math.min(200, useStage().width - 16);

  const isWin = gameResult === 'win';
  const isLoss = gameResult === 'loss';

  useEffect(() => { if (gameResult !== 'draw') haptic(gameResult === 'win' ? 'win' : 'loss'); }, [gameResult]);

  useEffect(() => {
    if (!isWin) return;
    const pops = [0, 1, 2, 3, 4].map(i => setTimeout(() => playSfx('pop', 0.8, 1 + i * 0.12), 500 + i * 90));
    const sparkle = setTimeout(() => playSfx('sparkle'), 900);
    return () => { pops.forEach(clearTimeout); clearTimeout(sparkle); };
  }, [isWin]);

  return (
    <div className="absolute inset-0">
      <MenuBackground />
      {isLoss && <div className="absolute inset-0 z-[4]" style={{ background: 'rgba(11, 13, 12, 0.55)' }} />}
      {isWin && <Rays x={cx} y={playY + 34} />}
      {isWin && <Confetti />}
      <Mascot rank={gameResult === 'loss' ? 'K' : 'J'} owner={gameResult === 'loss' ? 'opponent' : 'player'} x={cx - 16} y={board.diorama.y + 6} />

      <motion.div
        className="absolute z-10"
        style={{ left: cx - Math.floor(panelWidth / 2), top: playY - 14 }}
        initial={{ y: -200, rotate: isLoss ? 8 : -6 }}
        animate={isLoss ? { y: 0, rotate: [8, -3, 2, 0], x: [0, -4, 4, -2, 0] } : { y: 0, rotate: 0 }}
        transition={{ type: 'spring', stiffness: isLoss ? 500 : 260, damping: isLoss ? 20 : 12, delay: 0.25 }}
      >
      <Panel title={<TitleLetters text={t[ui.title]} />} band={ui.band} style={{ width: panelWidth, height: 96 }} bodyClassName="p-[6px] flex flex-col gap-[6px]">
        <p className="text-center leading-[12px]">{t[ui.sub]}</p>
        <PxButton tone="yellow" onClick={() => { playSound('click'); startGame(); }} className="h-[20px]">{t.play_again}</PxButton>
        <PxButton onClick={() => { playSound('click'); exitToMenu(); }} className="h-[16px]">{t.exit_menu}</PxButton>
      </Panel>
      </motion.div>
    </div>
  );
};
