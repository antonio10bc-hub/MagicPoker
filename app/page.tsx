'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { playMusic, preloadSounds, stopMusic } from '@/lib/sounds';
import { steps } from '@/theme/tokens';
import { Stage } from '@/components/pixel/Stage';
import { MenuScreen } from '@/components/screens/MenuScreen';
import { GameScreen } from '@/components/screens/GameScreen';
import { EndScreen } from '@/components/screens/EndScreen';

const SCREENS = { menu: MenuScreen, game: GameScreen, end: EndScreen };

/** Transición entre pantallas: persiana en escalones de arriba a abajo */
const WIPE = {
  initial: { clipPath: 'inset(0 0 100% 0)' },
  animate: { clipPath: 'inset(0 0 0% 0)', transition: { duration: 0.2, ease: steps(6) } },
  exit: { clipPath: 'inset(100% 0 0 0)', transition: { duration: 0.15, ease: steps(4) } },
};

export default function Home() {
  const screen = useGameStore(s => s.screen);
  const isEnd = useGameStore(s => s.phase === 'end');
  const current = screen === 'menu' ? 'menu' : isEnd ? 'end' : 'game';
  const Screen = SCREENS[current];

  useEffect(preloadSounds, []);

  // --- CONTROL DE MÚSICA SEGÚN PANTALLA ---
  useEffect(() => {
    if (screen === 'menu') playMusic('menu_music', 0.4);
    else if (isEnd) stopMusic();
    else playMusic('game_music', 0.2);
  }, [screen, isEnd]);

  return (
    <Stage>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={current} className="absolute inset-0" {...WIPE}>
          <Screen />
        </motion.div>
      </AnimatePresence>
    </Stage>
  );
}
