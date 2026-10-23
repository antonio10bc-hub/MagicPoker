import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useUiStore } from '@/store/useUiStore';
import { currentBossIndex, getProgress } from '@/lib/bosses';
import { peekMapSeen, setMapSeen } from '@/lib/mapReveal';
import { MerchantScene } from '@/components/game/MerchantScene';
import { useTranslations, Translations } from '@/lib/i18n';
import { haptic, playSfx, playSound } from '@/lib/sounds';
import { useEffect, useState } from 'react';
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

/** Título que aparece letra a letra con rebote (los largos, en letra más pequeña para caber) */
const TitleLetters = ({ text }: { text: string }) => (
  <span className="inline-flex whitespace-nowrap" style={{ fontSize: text.length > 12 ? 9 : undefined }}>
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
  const [wasTutorial] = useState(() => useGameStore.getState().tutorialStep !== null);
  const { result, bossIndex, rematch, startGame, exitToMenu } = useGameStore(useShallow(s => ({
    result: s.gameResult ?? 'loss',
    bossIndex: s.bossIndex,
    rematch: s.rematch,
    startGame: s.startGame,
    exitToMenu: s.exitToMenu,
  })));
  // Se fija al aparecer: al salir, la partida ya se ha reiniciado (sin resultado)
  const [gameResult] = useState(result);
  const ui = RESULT_UI[gameResult];
  const { cx, board, mascotY } = useMenuLayout();
  // El panel de resultado va centrado sobre el tapete
  const panelY = mascotY - 2;
  const panelWidth = Math.min(210, useStage().width - 16);

  const isWin = gameResult === 'win';
  // Tras vencer a un jefe hay otro esperando (el siguiente de la lista)
  const [castleOutcome] = useState(() => useGameStore.getState().castleOutcome);
  const startCastle = useGameStore(s => s.startCastle);
  const [hasNextBoss] = useState(() => result === 'win' && useGameStore.getState().tutorialStep === null && currentBossIndex() !== useGameStore.getState().bossIndex);
  const isLoss = gameResult === 'loss';
  // Jefe vencido por primera vez: el mapa tiene algo que contar (el siguiente, el secreto o el Castillo)
  const [toMap] = useState(() => {
    if (result !== 'win' || useGameStore.getState().tutorialStep !== null || castleOutcome) return false;
    const { defeated } = getProgress();
    const seen = peekMapSeen();
    // Sin dato aún: lo nuevo es solo este jefe
    if (seen === null && defeated > 0) setMapSeen(defeated - 1);
    return defeated > (seen ?? defeated - 1);
  });
  // Orden de celebraciones: sello de carta > logros > resultado. El panel espera a que
  // se hayan mostrado los desbloqueos y los logros pendientes.
  const waiting = useUiStore(s => s.unlockQueue.length + s.stampQueue.length > 0);

  useEffect(() => { if (gameResult !== 'draw') haptic(gameResult === 'win' ? 'win' : 'loss'); }, [gameResult]);

  useEffect(() => {
    if (!isWin || waiting) return;
    const pops = [0, 1, 2, 3, 4].map(i => setTimeout(() => playSfx('pop', 0.8, 1 + i * 0.12), 500 + i * 90));
    const sparkle = setTimeout(() => playSfx('sparkle'), 900);
    return () => { pops.forEach(clearTimeout); clearTimeout(sparkle); };
  }, [isWin, waiting]);

  // Castillo, jefe vencido: en vez del panel, entra el mercader con sus mejoras
  if (castleOutcome?.kind === 'next') {
    return (
      <div className="absolute inset-0">
        <MenuBackground />
        {!waiting && <MerchantScene floor={castleOutcome.run.stage} />}
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <MenuBackground />
      {isLoss && <div className="absolute inset-0 z-[4]" style={{ background: 'rgba(11, 13, 12, 0.55)' }} />}
      {isWin && !waiting && <Rays x={cx} y={panelY + 48} />}
      {isWin && !waiting && <Confetti />}
      <Mascot rank={gameResult === 'loss' ? 'K' : 'J'} owner={gameResult === 'loss' ? 'opponent' : 'player'} x={cx - 16} y={board.diorama.y + 6} />

      {!waiting && <motion.div
        className="absolute z-10"
        style={{ left: cx - Math.floor(panelWidth / 2), top: panelY }}
        initial={{ y: -200, rotate: isLoss ? 8 : -6 }}
        animate={isLoss ? { y: 0, rotate: [8, -3, 2, 0], x: [0, -4, 4, -2, 0] } : { y: 0, rotate: 0 }}
        // Derrota: caída seca con temblor (varios fotogramas: sin muelle); victoria: muelle
        transition={isLoss ? { duration: 0.6, ease: 'easeOut', delay: 0.25 } : { type: 'spring', stiffness: 260, damping: 12, delay: 0.25 }}
      >
      {/* Mismo esquema que las ventanas pequeñas: banda, texto y pie de acciones */}
      <Panel
        title={<TitleLetters text={castleOutcome?.kind === 'conquered' ? t.castle_conquered : t[ui.title]} />}
        band={castleOutcome && castleOutcome.kind !== 'fallen' ? 'var(--ink-crimson)' : ui.band}
        titleClassName={castleOutcome && castleOutcome.kind !== 'fallen' ? 'text-ink' : undefined}
        style={{ width: panelWidth }} bodyClassName="flex flex-col">
        <div className="p-[6px]">
          <p className="text-center leading-[12px]">
            {castleOutcome
              ? (castleOutcome.kind === 'conquered' ? t.castle_conquered_sub : t.castle_fallen.replace('{n}', String(castleOutcome.stage + 1)))
              : wasTutorial ? t.tut_done : t[ui.sub]}
          </p>
        </div>
        <div className="p-[6px] flex flex-col gap-[4px]" style={{ boxShadow: 'inset 0 1px 0 0 rgba(185,207,200,0.1)' }}>
          {castleOutcome ? (
            <>
              <PxButton size="lg" tone="yellow" onClick={() => { playSound('click'); startCastle(); }}>{t.castle_again}</PxButton>
              {/* Resumen de toda la subida: estadísticas y mazo final */}
              <PxButton size="md" tone="roof" aria-label={t.aria_run_summary} onClick={() => { playSound('click'); useUiStore.getState().openModal('summary'); }}>{t.sum_button}</PxButton>
            </>
          ) : toMap ? (
            // Jefe nuevo vencido: al mapa, que cuenta lo que se desbloquea
            <PxButton size="lg" tone="yellow" onClick={() => { playSound('click'); exitToMenu(); }}>{t.to_map}</PxButton>
          ) : (
            // Si ganas, al siguiente jefe; si no, revancha contra el mismo
            <PxButton size="lg" tone="yellow" onClick={() => { playSound('click'); startGame(wasTutorial || isWin ? undefined : bossIndex, rematch && !isWin); }}>
              {hasNextBoss ? t.next_boss : t.play_again}
            </PxButton>
          )}
          {!toMap && <PxButton size="md" onClick={() => { playSound('click'); exitToMenu(); }}>{t.exit_menu}</PxButton>}
        </div>
      </Panel>
      </motion.div>}
    </div>
  );
};
