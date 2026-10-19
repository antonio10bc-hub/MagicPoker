'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { playMusic, preloadSounds, setMusicHeat, stopMusic } from '@/lib/sounds';
import { Stage } from '@/components/pixel/Stage';
import { MenuScreen } from '@/components/screens/MenuScreen';
import { GameScreen } from '@/components/screens/GameScreen';
import { EndScreen } from '@/components/screens/EndScreen';
import { Modals } from '@/components/modals/Modals';
import { StampToasts } from '@/components/game/Stamps';

const SCREENS = { menu: MenuScreen, game: GameScreen, end: EndScreen };

/** Transición entre pantallas: iris circular que se abre, con un leve zoom */
const IRIS = {
  initial: { clipPath: 'circle(0% at 50% 50%)', scale: 1.08 },
  animate: { clipPath: 'circle(150% at 50% 50%)', scale: 1, transition: { duration: 0.55, ease: [0.65, 0, 0.35, 1] as [number, number, number, number] } },
  exit: { clipPath: 'circle(0% at 50% 50%)', scale: 0.96, transition: { duration: 0.35, ease: [0.65, 0, 0.35, 1] as [number, number, number, number] } },
};

export default function Home() {
  const screen = useGameStore(s => s.screen);
  const isEnd = useGameStore(s => s.phase === 'end');
  const isFight = useGameStore(s => s.phase === 'combat' || s.phase === 'combat-reveal');
  const current = screen === 'menu' ? 'menu' : isEnd ? 'end' : 'game';
  const Screen = SCREENS[current];

  useEffect(preloadSounds, []);

  // Al estar listo (fuentes cargadas), se retira la pantalla de carga y se registra el
  // service worker para poder jugar sin conexión
  useEffect(() => {
    const started = performance.now();
    document.fonts.ready.then(() => {
      setTimeout(() => document.documentElement.classList.add('ready'), Math.max(0, 700 - (performance.now() - started)));
    });
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* sin soporte o en privado */ });
    }
  }, []);

  // --- CONTROL DE MÚSICA SEGÚN PANTALLA ---
  useEffect(() => {
    if (screen === 'menu') playMusic('menu_music', 0.55);
    else if (isEnd) stopMusic();
    else playMusic('game_music', 0.4);
  }, [screen, isEnd]);

  // La música se tensa durante la pelea
  useEffect(() => { setMusicHeat(isFight ? 1 : 0); }, [isFight]);

  return (
    <Stage>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={current} className="absolute inset-0" {...IRIS}>
          <Screen />
        </motion.div>
      </AnimatePresence>
      <Modals />
      <StampToasts />
    </Stage>
  );
}
