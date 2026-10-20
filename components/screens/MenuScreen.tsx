import { CSSProperties, useSyncExternalStore } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUiStore } from '@/store/useUiStore';
import { useTranslations } from '@/lib/i18n';
import { playSound } from '@/lib/sounds';
import { motion } from 'framer-motion';
import { AmbientDust } from '@/components/fx/Ambient';
import { consumeFirstPlay } from '@/lib/stats';
import { loadGame } from '@/lib/savegame';
import { isTutorialDone } from '@/lib/tutorial';
import { Owner, Rank } from '@/types';
import { ACTIVE_THEME } from '@/themes';
import { IconButton, PxButton } from '@/components/pixel/ui';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { CHARACTERS, ICONS } from '@/components/pixel/sprites';
import { INK } from '@/theme/tokens';
import { useMenuLayout } from '@/components/pixel/Stage';

const noSubscribe = () => () => {};
const hasSavedGame = () => loadGame() !== null;
const { Backdrop, Diorama } = ACTIVE_THEME;

/** Fondo de menú y final: la plaza vacía */
export const MenuBackground = () => {
  const { board } = useMenuLayout();
  const d = board.diorama;
  const origin = `${d.x + d.w / 2}px ${d.y + d.h / 2}px`;
  return (
    <>
      <Backdrop />
      <AmbientDust />
      {/* Diorama con cámara 3D que se mece despacio */}
      <div className="absolute inset-0" style={{ perspective: 650, perspectiveOrigin: origin }}>
        <motion.div
          className="absolute inset-0"
          style={{ transformStyle: 'preserve-3d', transformOrigin: origin }}
          initial={{ rotateX: 40, scale: 0.9, opacity: 0 }}
          animate={{ rotateX: 14, rotateY: [-3, 3, -3], scale: 1, opacity: 1 }}
          transition={{ rotateX: { type: 'spring', stiffness: 60, damping: 14 }, scale: { duration: 0.8 }, opacity: { duration: 0.4 }, rotateY: { duration: 12, repeat: Infinity, ease: 'easeInOut' } }}
        >
          <Diorama board={board} />
        </motion.div>
      </div>
    </>
  );
};

/** Sin contorno: las dos tintas del logo no casan del todo (desajuste de registro) */
const MISREGISTER = '-1px 0 0 rgba(255,74,28,0.55), 1px 0.5px 0 rgba(94,122,118,0.6)';

/** Una palabra del logo: letras que caen con muelle y luego ondulan sin parar */
const LogoWord = ({ word, color, offset, glow }: { word: string; color: string; offset: number; glow?: boolean }) => (
  <div className="flex font-display">
    {word.split('').map((ch, i) => (
      <motion.span
        key={i}
        initial={{ y: -90, rotate: -25, opacity: 0, scale: 1.6 }}
        animate={{ y: 0, rotate: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 13, delay: 0.15 + (offset + i) * 0.06 }}
        style={{ display: 'inline-block' }}
      >
        <span
          className="anim-wave"
          style={{ fontSize: 46, lineHeight: '38px', letterSpacing: '0.04em', color, animationDelay: `${(offset + i) * 0.1}s`,
            textShadow: glow ? `${MISREGISTER}, 0 0 6px rgba(255,74,28,0.8), 0 0 16px rgba(242,101,42,0.4)` : MISREGISTER } as CSSProperties}
        >
          {ch}
        </span>
      </motion.span>
    ))}
  </div>
);

export const Logo = ({ y }: { y: number }) => (
  <div className="absolute left-0 right-0 flex flex-col items-center z-20" style={{ top: y }}>
    <LogoWord word="MAGIC" color="var(--ink-orange)" offset={0} glow />
    <LogoWord word="POKER" color="var(--ink-cream)" offset={5} />
  </div>
);

/** Personaje decorativo de pie sobre la plaza, con sombra y "idle" de 1 px */
export const Mascot = ({ rank, owner, x, y, delay = 0 }: { rank: Rank; owner: Owner; x: number; y: number; delay?: number }) => (
  <motion.div
    className="absolute z-10" style={{ left: x, top: y }}
    initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
    transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.5 + delay }}
  >
    {/* Sombra que se encoge cuando salta */}
    <motion.div className="absolute" style={{ left: 4, top: 40, width: 44, height: 6, borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(11,13,12,0.85) 30%, transparent 70%)', transform: 'skewX(-40deg)' }}
      animate={{ scaleX: [1, 0.6, 1, 1] }} transition={{ duration: 0.7, times: [0, 0.4, 0.8, 1], repeat: Infinity, repeatDelay: 2.2, delay: 1.5 + delay }} />
    {/* Salto con estiramiento y aplastamiento */}
    <motion.div style={{ transformOrigin: '50% 100%' }}
      animate={{ y: [0, -14, 0, 0], scaleY: [1, 1.1, 0.85, 1], scaleX: [1, 0.92, 1.12, 1] }}
      transition={{ duration: 0.7, times: [0, 0.4, 0.8, 1], repeat: Infinity, repeatDelay: 2.2, delay: 1.5 + delay }}>
      {/* Tú: silueta negra; el rival: masa naranja que brilla */}
      <div className={owner === 'opponent' ? 'anim-breathe bloom-shape' : 'anim-breathe'} style={{ animationDelay: `${delay}s` }}>
        <PixelSprite sprite={CHARACTERS[rank]!} tint={owner === 'opponent' ? INK.orange : INK.black} scale={2} />
      </div>
    </motion.div>
  </motion.div>
);

export const MenuScreen = () => {
  const t = useTranslations();
  const startGame = useGameStore(s => s.startGame);

  // Empieza la partida y, si es la primera vez, abre el tutorial
  const handleStartGame = () => {
    playSound('click');
    // La primera vez se juega el tutorial guiado (si no se completó antes)
    const first = consumeFirstPlay();
    if (first && !isTutorialDone()) useGameStore.getState().startTutorial();
    else startGame();
  };

  const { cx, logoY, playY, mascotY } = useMenuLayout();
  // ¿Hay una partida a medias? (solo en el navegador)
  const hasSave = useSyncExternalStore(noSubscribe, hasSavedGame, () => false);
  const resumeGame = useGameStore(s => s.resumeGame);

  return (
    <div className="absolute inset-0">
      <MenuBackground />
      {/* Reglas, estadísticas y ajustes también desde el menú */}
      <div className="absolute z-30 flex gap-[3px]" style={{ right: 4, top: 4 }}>
        <IconButton icon={ICONS.info} aria-label="rules" onClick={() => { playSound('click'); useUiStore.getState().openModal('rules'); }} />
        <IconButton icon={ICONS.trophy} aria-label="stats" onClick={() => { playSound('click'); useUiStore.getState().openModal('stats'); }} />
        <IconButton icon={ICONS.gear} aria-label="settings" onClick={() => { playSound('click'); useUiStore.getState().openModal('settings'); }} />
      </div>
      <Logo y={logoY} />
      {/* Las dos siluetas, frente a frente en el centro del tapete */}
      <Mascot rank="J" owner="player" x={cx - 44} y={mascotY} />
      <Mascot rank="K" owner="opponent" x={cx + 8} y={mascotY} delay={0.3} />

      <motion.div className="absolute z-20" style={{ left: cx - 50, top: playY, width: 100, height: 28 }}
        initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.9 }}>
        <PxButton tone="yellow" onClick={handleStartGame} className="text-title w-full h-full overflow-hidden anim-breathe">
          {t.play}
        </PxButton>
      </motion.div>

      {hasSave && (
        <motion.div className="absolute z-20" style={{ left: cx - 50, top: playY + 32, width: 100, height: 16 }}
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }}>
          <PxButton onClick={() => { playSound('click'); resumeGame(); }} className="w-full h-full">{t.continue_game}</PxButton>
        </motion.div>
      )}

    </div>
  );
};
