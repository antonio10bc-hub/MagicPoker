import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useUiStore } from '@/store/useUiStore';
import { useTranslations } from '@/lib/i18n';
import { playSfx, playSound } from '@/lib/sounds';
import { motion, MotionStyle } from 'framer-motion';
import { AmbientDust } from '@/components/fx/Ambient';
import { consumeFirstPlay } from '@/lib/stats';
import { TIMINGS } from '@/lib/constants';
import { Difficulty, Owner, Rank } from '@/types';
import { ACTIVE_THEME } from '@/themes';
import { Panel, PxButton } from '@/components/pixel/ui';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { CHARACTERS } from '@/components/pixel/sprites';
import { useMenuLayout } from '@/components/pixel/Stage';

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];
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
          style={{ transformStyle: 'preserve-3d', transformOrigin: origin, '--tilt': '14deg' } as MotionStyle}
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

/** Contorno de 2 px para texto grande */
const bigOutline = [-2, -1, 0, 1, 2]
  .flatMap(x => [-2, -1, 0, 1, 2].map(y => `${x}px ${y}px 0 var(--c-outline)`))
  .join(', ');

/** Una palabra del logo: letras que caen con muelle y luego ondulan sin parar */
const LogoWord = ({ word, color, offset }: { word: string; color: string; offset: number }) => (
  <div className="flex">
    {word.split('').map((ch, i) => (
      <motion.span
        key={i}
        initial={{ y: -90, rotate: -25, opacity: 0, scale: 1.6 }}
        animate={{ y: 0, rotate: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 13, delay: 0.15 + (offset + i) * 0.06 }}
        style={{ display: 'inline-block' }}
      >
        <motion.span
          style={{ display: 'inline-block', fontSize: 40, lineHeight: '36px', color, textShadow: `${bigOutline}, 3px 4px 0 var(--c-outline)` }}
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 1 + (offset + i) * 0.1 }}
        >
          {ch}
        </motion.span>
      </motion.span>
    ))}
  </div>
);

export const Logo = ({ y }: { y: number }) => (
  <div className="absolute left-0 right-0 flex flex-col items-center z-20" style={{ top: y }}>
    <LogoWord word="MAGIC" color="var(--c-yellow)" offset={0} />
    <LogoWord word="POKER" color="var(--c-white)" offset={5} />
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
    <motion.div className="absolute" style={{ left: 2, top: 40, width: 30, height: 6, borderRadius: '50%', background: 'var(--c-shadow)' }}
      animate={{ scaleX: [1, 0.6, 1, 1] }} transition={{ duration: 0.7, times: [0, 0.4, 0.8, 1], repeat: Infinity, repeatDelay: 2.2, delay: 1.5 + delay }} />
    {/* Salto con estiramiento y aplastamiento */}
    <motion.div style={{ transformOrigin: '50% 100%' }}
      animate={{ y: [0, -14, 0, 0], scaleY: [1, 1.1, 0.85, 1], scaleX: [1, 0.92, 1.12, 1] }}
      transition={{ duration: 0.7, times: [0, 0.4, 0.8, 1], repeat: Infinity, repeatDelay: 2.2, delay: 1.5 + delay }}>
      <div className="anim-breathe" style={{ animationDelay: `${delay}s` }}>
        <PixelSprite sprite={CHARACTERS[rank]!} owner={owner} scale={2} />
      </div>
    </motion.div>
  </motion.div>
);

export const MenuScreen = () => {
  const t = useTranslations();
  const { difficulty, setDifficulty, startGame } = useGameStore(useShallow(s => ({
    difficulty: s.difficulty,
    setDifficulty: s.setDifficulty,
    startGame: s.startGame,
  })));

  // Empieza la partida y, si es la primera vez, abre el tutorial
  const handleStartGame = () => {
    playSound('click');
    startGame();
    if (consumeFirstPlay()) {
      setTimeout(() => useUiStore.getState().openModal('rules'), TIMINGS.rulesOnFirstGame);
    }
  };

  const { cx, logoY, playY, difficultyY, panelW } = useMenuLayout();

  return (
    <div className="absolute inset-0">
      <MenuBackground />
      <Logo y={logoY} />
      <Mascot rank="J" owner="player" x={cx - 100} y={playY - 8} />
      <Mascot rank="K" owner="opponent" x={cx + 68} y={playY - 8} delay={0.3} />

      <motion.div className="absolute z-20" style={{ left: cx - 50, top: playY, width: 100, height: 28 }}
        initial={{ scale: 0, rotate: -10 }} animate={{ scale: [1, 1.06, 1], rotate: 0 }}
        transition={{ scale: { duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }, rotate: { type: 'spring', stiffness: 300, damping: 12, delay: 0.9 } }}>
        <PxButton tone="yellow" onClick={handleStartGame} className="text-title w-full h-full overflow-hidden">
          {t.play}
          <span className="anim-shine absolute top-0 bottom-0 left-0 w-[14px] pointer-events-none" style={{ background: 'rgba(255,255,255,0.5)' }} />
        </PxButton>
      </motion.div>

      <motion.div className="absolute z-20" style={{ left: cx - Math.floor(panelW / 2), top: difficultyY }}
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 1 }}>
      <Panel title={t.difficulty} band="var(--c-orange)" style={{ width: panelW, height: 44 }} bodyClassName="flex gap-[4px] p-[5px]">
        {DIFFICULTIES.map(d => (
          <PxButton
            key={d}
            tone={difficulty === d ? 'roof' : 'white'}
            data-pressed={difficulty === d}
            onClick={() => { playSound('click'); playSfx('select', 0.6); setDifficulty(d); }}
            className="flex-1 h-[16px]"
          >
            <span className={difficulty === d ? 'text-outline' : undefined}>{t[d]}</span>
          </PxButton>
        ))}
      </Panel>
      </motion.div>
    </div>
  );
};
