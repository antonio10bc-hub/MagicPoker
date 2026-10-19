'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { playMusic, preloadSounds, stopMusic } from '@/lib/sounds';
import { MenuScreen } from '@/components/screens/MenuScreen';
import { GameScreen } from '@/components/screens/GameScreen';
import { EndScreen } from '@/components/screens/EndScreen';

export default function Home() {
  const screen = useGameStore(s => s.screen);
  const isEnd = useGameStore(s => s.phase === 'end');

  useEffect(preloadSounds, []);

  // --- CONTROL DE MÚSICA SEGÚN PANTALLA ---
  useEffect(() => {
    if (screen === 'menu') playMusic('menu_music', 0.4);
    else if (isEnd) stopMusic();
    else playMusic('game_music', 0.2);
  }, [screen, isEnd]);

  if (screen === 'menu') return <MenuScreen />;
  if (isEnd) return <EndScreen />;
  return <GameScreen />;
}
