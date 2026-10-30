'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { playMusic, preloadSounds, setMusicHeat, setMusicTension, stopMusic } from '@/lib/sounds';
import { Stage } from '@/components/pixel/Stage';
import { MenuScreen } from '@/components/screens/MenuScreen';
import { GameScreen } from '@/components/screens/GameScreen';
import { EndScreen } from '@/components/screens/EndScreen';
import { ForestScreen } from '@/components/screens/ForestScreen';
import { bossMusic } from '@/lib/bossMusic';
import { BOSSES, getProgress } from '@/lib/bosses';
import { getCastle } from '@/lib/castle';
import { isTutorialDone } from '@/lib/tutorial';
import { initAnalytics, track } from '@/lib/analytics';
import { initDebugFromUrl } from '@/lib/debug';
import { startQualityProbe } from '@/lib/quality';
import { archetype } from '@/lib/forest';
import { Modals } from '@/components/modals/Modals';
import { StampToasts } from '@/components/game/Stamps';
import { UnlockToasts } from '@/components/game/UnlockToasts';
import { IS_DESKTOP } from '@/lib/platform';

const SCREENS = { menu: MenuScreen, forest: ForestScreen, game: GameScreen, end: EndScreen };

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
  const current = screen === 'menu' ? 'menu' : screen === 'forest' ? 'forest' : isEnd ? 'end' : 'game';
  const Screen = SCREENS[current];

  useEffect(preloadSounds, []);
  useEffect(initDebugFromUrl, []);
  // Calidad gráfica: si el dispositivo va justo, bajo consumo
  useEffect(startQualityProbe, []);

  // Analíticas: arrancan una vez con el dispositivo y el progreso del jugador
  useEffect(() => {
    const progress = getProgress();
    const castle = getCastle();
    const portrait = window.innerHeight > window.innerWidth;
    initAnalytics({ orientation: portrait ? 'portrait' : 'landscape', pointer: matchMedia('(pointer: fine)').matches ? 'mouse' : 'touch' });
    track('app_opened', {
      bosses_defeated: progress.defeated, castle_unlocked: progress.defeated >= BOSSES.length, castle_conquered: castle.conquered,
      castle_best_floor: castle.best, tutorial_done: isTutorialDone(), installed: matchMedia('(display-mode: standalone)').matches,
    });
  }, []);
  // Pantalla en la que está (menú, partida, final)
  useEffect(() => { track('screen_viewed', { screen: current }); }, [current]);

  // Al estar listo (fuentes cargadas), se retira la pantalla de carga y se registra el
  // service worker para poder jugar sin conexión
  useEffect(() => {
    const started = performance.now();
    document.fonts.ready.then(() => {
      setTimeout(() => document.documentElement.classList.add('ready'), Math.max(0, 700 - (performance.now() - started)));
    });
    // (en escritorio no hace falta: el juego ya va dentro de la app)
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production' && !IS_DESKTOP) {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* sin soporte o en privado */ });
    }
  }, []);

  // --- CONTROL DE MÚSICA SEGÚN PANTALLA ---
  // Cada jefe suena a lo suyo (en el tutorial, el tema de siempre)
  // (en el Bosque, el del jefe que más se parece a quien ha salido)
  const musicBoss = useGameStore(s => (s.tutorialStep !== null ? undefined : s.forest ? archetype(s.forest.id)?.music : BOSSES[s.bossIndex]?.id));
  const inCastle = useGameStore(s => !!s.castle);
  useEffect(() => {
    if (screen === 'menu') playMusic('menu_music', 0.55);
    else if (screen === 'forest') playMusic('menu_music', 0.3);
    else if (isEnd) stopMusic();
    else playMusic('game_music', 0.4, musicBoss ? bossMusic(musicBoss, inCastle) : undefined);
  }, [screen, isEnd, musicBoss, inCastle]);

  // La música se tensa durante la pelea y crece al borde: con 1 vida (de cualquiera) a
  // tope; con 2, a medias; el Soberano en su fase 2, siempre a tope
  useEffect(() => { setMusicHeat(isFight ? 1 : 0); }, [isFight]);
  const tension = useGameStore(s => {
    if (s.screen !== 'game' || s.phase === 'end' || s.tutorialStep !== null) return 0;
    const low = Math.min(s.player.lives, s.opponent.lives);
    return s.castle?.phase2 || low <= 1 ? 1 : low === 2 ? 0.5 : 0;
  });
  useEffect(() => { setMusicTension(tension); }, [tension]);

  return (
    <Stage>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={current} className="absolute inset-0" {...IRIS}>
          <Screen />
        </motion.div>
      </AnimatePresence>
      <Modals />
      <StampToasts />
      <UnlockToasts />
    </Stage>
  );
}
