import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useTranslations, Translations } from '@/lib/i18n';
import { playSound } from '@/lib/sounds';
import { GameResult } from '@/types';
import { PALETTE, steps } from '@/theme/tokens';
import { useMenuLayout, useStage } from '@/components/pixel/Stage';
import { Panel, PxButton } from '@/components/pixel/ui';
import { Mascot, MenuBackground } from './MenuScreen';

const RESULT_UI: Record<GameResult, { title: keyof Translations; sub: keyof Translations; band: string }> = {
  win: { title: 'win', sub: 'win_sub', band: 'var(--c-green)' },
  draw: { title: 'draw', sub: 'draw_sub', band: 'var(--c-glass)' },
  loss: { title: 'loss', sub: 'loss_sub', band: 'var(--c-red)' },
};

// --- CONFETI EN PÍXEL (determinista, sin Math.random en el render) ---
const CONFETTI_COLORS = [PALETTE.yellow, PALETTE.green, PALETTE.cyan, PALETTE.roof, PALETTE.white];
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
          style={{ left: Math.floor(c.fx * width), top: -4, width: c.size, height: c.size, background: c.color, boxShadow: '1px 1px 0 0 var(--c-outline)' }}
          animate={{ y: [0, height + 8] }}
          transition={{ duration: c.duration, delay: c.delay, repeat: 2, ease: steps(24) }}
        />
      ))}
    </>
  );
};

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

  return (
    <div className="absolute inset-0">
      <MenuBackground />
      {gameResult === 'win' && <Confetti />}
      <Mascot rank={gameResult === 'loss' ? 'K' : 'J'} owner={gameResult === 'loss' ? 'opponent' : 'player'} x={cx - 16} y={board.diorama.y + 6} />

      <Panel title={t[ui.title]} band={ui.band} className="absolute z-10" style={{ left: cx - Math.floor(panelWidth / 2), top: playY - 14, width: panelWidth, height: 96 }} bodyClassName="p-[6px] flex flex-col gap-[6px]">
        <p className="text-center leading-[12px]">{t[ui.sub]}</p>
        <PxButton tone="yellow" onClick={() => { playSound('click'); startGame(); }} className="h-[20px]">{t.play_again}</PxButton>
        <PxButton onClick={() => { playSound('click'); exitToMenu(); }} className="h-[16px]">{t.exit_menu}</PxButton>
      </Panel>
    </div>
  );
};
