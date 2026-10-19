import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useUiStore } from '@/store/useUiStore';
import { useTranslations } from '@/lib/i18n';
import { playSound } from '@/lib/sounds';
import { consumeFirstPlay } from '@/lib/stats';
import { TIMINGS } from '@/lib/constants';
import { Difficulty, Owner, Rank } from '@/types';
import { ACTIVE_THEME } from '@/themes';
import { Panel, PxButton } from '@/components/pixel/ui';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { CHARACTERS } from '@/components/pixel/sprites';

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];
const { MenuBackground } = ACTIVE_THEME;

/** Contorno de 2 px para texto grande */
const bigOutline = [-2, -1, 0, 1, 2]
  .flatMap(x => [-2, -1, 0, 1, 2].map(y => `${x}px ${y}px 0 var(--c-outline)`))
  .join(', ');

export const Logo = ({ y }: { y: number }) => (
  <div className="absolute left-0 right-0 flex flex-col items-center" style={{ top: y }}>
    <span style={{ fontSize: 40, lineHeight: '36px', color: 'var(--c-yellow)', textShadow: `${bigOutline}, 3px 4px 0 var(--c-outline)` }}>MAGIC</span>
    <span style={{ fontSize: 40, lineHeight: '36px', color: 'var(--c-white)', textShadow: `${bigOutline}, 3px 4px 0 var(--c-outline)` }}>POKER</span>
  </div>
);

/** Personaje decorativo de pie sobre la plaza, con sombra y "idle" de 1 px */
export const Mascot = ({ rank, owner, x, y, delay = 0 }: { rank: Rank; owner: Owner; x: number; y: number; delay?: number }) => (
  <div className="absolute" style={{ left: x, top: y }}>
    <div className="absolute" style={{ left: 2, top: 40, width: 30, height: 6, borderRadius: '50%', background: 'var(--c-shadow)' }} />
    <div className="anim-bob" style={{ animationDelay: `${delay}s` }}>
      <PixelSprite sprite={CHARACTERS[rank]!} owner={owner} scale={2} />
    </div>
  </div>
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

  return (
    <div className="absolute inset-0">
      <MenuBackground />
      <Logo y={34} />
      <Mascot rank="J" owner="player" x={92} y={118} />
      <Mascot rank="K" owner="opponent" x={260} y={118} delay={0.3} />

      <PxButton tone="yellow" onClick={handleStartGame} className="absolute text-title" style={{ left: 142, top: 126, width: 100, height: 28 }}>
        {t.play}
      </PxButton>

      <Panel title={t.difficulty} band="var(--c-roof)" className="absolute" style={{ left: 102, top: 176, width: 180, height: 44 }} bodyClassName="flex gap-[4px] p-[5px]">
        {DIFFICULTIES.map(d => (
          <PxButton
            key={d}
            tone={difficulty === d ? 'roof' : 'white'}
            data-pressed={difficulty === d}
            onClick={() => { playSound('click'); setDifficulty(d); }}
            className="flex-1 h-[16px]"
          >
            <span className={difficulty === d ? 'text-outline' : undefined}>{t[d]}</span>
          </PxButton>
        ))}
      </Panel>
    </div>
  );
};
