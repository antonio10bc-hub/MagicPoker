import { CSSProperties, useState, useSyncExternalStore } from 'react';
import { clsx } from 'clsx';
import { useGameStore } from '@/store/useGameStore';
import { useUiStore } from '@/store/useUiStore';
import { Translations, useTranslations } from '@/lib/i18n';
import { playSound } from '@/lib/sounds';
import { motion } from 'framer-motion';
import { AmbientDust } from '@/components/fx/Ambient';
import { consumeFirstPlay } from '@/lib/stats';
import { loadGame } from '@/lib/savegame';
import { isDebug } from '@/lib/debug';
import { isForestUnlocked } from '@/lib/forest';
import { forestAnnounced, ForestAwaken } from './ForestAwaken';
import { isTutorialDone } from '@/lib/tutorial';
import { Owner, Rank } from '@/types';
import { ACTIVE_THEME } from '@/themes';
import { IconButton, PxButton } from '@/components/pixel/ui';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { CHARACTERS, ICONS } from '@/components/pixel/sprites';
import { CASTLE_INDEX, SagaMap } from './SagaMap';
import { BOSSES, currentBossIndex, getProgress, getServerProgress, isCastleUnlocked, isCollectionUnlocked, isEditorUnlocked, rematchLevel, subscribeProgress } from '@/lib/bosses';
import { getCastle, getServerCastle, subscribeCastle } from '@/lib/castle';
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
const LogoWord = ({ word, color, offset, glow, size = 46 }: { word: string; color: string; offset: number; glow?: boolean; size?: number }) => (
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
          style={{ fontSize: size, lineHeight: `${Math.round(size * 0.83)}px`, letterSpacing: '0.04em', color, animationDelay: `${(offset + i) * 0.1}s`,
            textShadow: glow ? `${MISREGISTER}, 0 0 6px rgba(255,74,28,0.8), 0 0 16px rgba(242,101,42,0.4)` : MISREGISTER } as CSSProperties}
        >
          {ch}
        </span>
      </motion.span>
    ))}
  </div>
);

export const Logo = ({ x = 0, w, y, size, align = 'center' }: { x?: number; w?: number; y: number; size?: number; align?: 'center' | 'start' }) => (
  <div className={clsx('absolute flex flex-col z-20 pointer-events-none', align === 'start' ? 'items-start' : 'items-center')} style={{ top: y, left: x, width: w ?? '100%' }}>
    <LogoWord word="MAGIC" color="var(--ink-orange)" offset={0} glow size={size} />
    <LogoWord word="POKER" color="var(--ink-cream)" offset={5} size={size} />
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
  // JUGAR juega contra el boss que está en pantalla (si ya lo has alcanzado)
  const menuBoss = useUiStore(s => s.menuBoss);

  // Empieza la partida y, si es la primera vez, abre el tutorial
  const handleStartGame = (rematch = false) => {
    playSound('click');
    // La primera vez se juega el tutorial guiado (si no se completó antes)
    const first = consumeFirstPlay();
    if (first && !isTutorialDone()) useGameStore.getState().startTutorial();
    else if (castleSel) {
      // Castillo: si quedó una mejora por elegir, primero eso
      // Subida nueva tras haberlo conquistado: antes, los desafíos
      const castle = getCastle();
      if (castle.run?.offer || castle.run?.chest) useUiStore.getState().openModal('boons');
      else if (!castle.run && castle.conquered > 0) useUiStore.getState().openModal('challenges');
      else useGameStore.getState().startCastle();
    } else startGame(selected, rematch);
  };

  const { map, mapSafeTop, mapSafeBottom, cta: ctaBox, logoSize } = useMenuLayout();
  // Mientras el mapa cuenta algo nuevo, el input queda bloqueado
  const [revealing, setRevealing] = useState(false);
  // Depuración (?debug=1): repetir las animaciones del mapa
  const mapReplay = useUiStore(s => s.mapReplay);
  const debug = useSyncExternalStore(noSubscribe, isDebug, () => false);
  const progress = useSyncExternalStore(subscribeProgress, getProgress, getServerProgress);
  const collection = isCollectionUnlocked(progress);
  const editor = isEditorUnlocked(progress);
  const current = currentBossIndex(progress);
  const selected = menuBoss ?? current;
  // La página de después del último jefe es el Castillo
  const castleSel = selected === CASTLE_INDEX && isCastleUnlocked(progress);
  const castleState = useSyncExternalStore(subscribeCastle, getCastle, getServerCastle);
  const castleRun = castleState.run;
  // El Bosque: tras conquistar el Castillo; la primera vez se anuncia por fases
  const forestOpen = isForestUnlocked(castleState);
  const forestReplay = useUiStore(s => s.forestReplay);
  const [awaken, setAwaken] = useState<boolean | null>(null);
  const awakening = !revealing && (forestReplay || (forestOpen && awaken === null && !forestAnnounced()));
  const showForest = forestOpen && !awakening;
  const locked = !castleSel && selected > current;
  // Revancha: solo contra un boss ya vencido
  const canRematch = selected < progress.defeated;
  const level = canRematch ? rematchLevel(selected, progress) : 0;
  // ¿Hay una partida a medias? (solo en el navegador)
  const hasSave = useSyncExternalStore(noSubscribe, hasSavedGame, () => false);
  const resumeGame = useGameStore(s => s.resumeGame);
  // Botón principal: el verbo y, debajo, contra quién o qué pasa
  const total = String(BOSSES.length);
  const cta = castleSel
    ? castleRun
      ? { title: t.castle_continue_title, sub: t.castle_floor_sub.replace('{n}', String(castleRun.stage + 1)).replace('{total}', total) }
      : { title: t.castle_enter, sub: t.castle_sub_new }
    : locked
      ? { title: t.challenge, sub: t.play_locked_sub }
      // Un jefe vencido solo se juega en revancha (cada vez más fuerte)
      : canRematch
        ? { title: t.rematch, sub: t.rematch_level_sub.replace('{n}', String(level)) }
        : { title: t.challenge, sub: t[`boss_${BOSSES[selected]?.id}` as keyof Translations] ?? '' };

  return (
    <div className="absolute inset-0">
      <Backdrop />
      <AmbientDust />
      {/* El camino de jefes, de abajo arriba; al final, el Castillo */}
      <SagaMap key={mapReplay ?? 'live'} rect={map} safeTop={mapSafeTop} safeBottom={mapSafeBottom + (showForest ? ctaBox.h + 4 : 0)} onRevealing={setRevealing}
        replay={mapReplay} onReplayDone={() => useUiStore.getState().setMapReplay(null)} eyes={showForest} />
      {/* El mapa llena la pantalla; cabecera y pie flotan encima y se funden con él */}
      <div className="absolute inset-x-0 top-0 z-20 pointer-events-none" style={{ height: mapSafeTop + 12, background: 'linear-gradient(to bottom, rgba(11,13,12,0.95) 55%, transparent)' }} />
      <div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none" style={{ height: mapSafeBottom + 20 + (showForest ? ctaBox.h + 4 : 0), background: 'linear-gradient(to top, rgba(11,13,12,0.97) 60%, transparent)' }} />

      {/* Arriba a la derecha: lo tuyo (colección, mazo) y reglas, estadísticas y ajustes */}
      <div className="absolute z-30 flex gap-[3px]" style={{ right: 4, top: 6 }}>
        {/* Todos los iconos con el mismo marco: lo tuyo (colección, mazo) lleva el icono
            de su color y va separado de lo del juego (reglas, estadísticas, ajustes) */}
        {collection && (
          <PxButton aria-label={t.aria_collection} className="w-[18px] h-[18px]" onClick={() => { playSound('click'); useUiStore.getState().openModal('collection'); }}>
            <PixelSprite sprite={ICONS.book} tint={INK.orange} />
          </PxButton>
        )}
        {editor && (
          <PxButton aria-label={t.aria_deck} className="w-[18px] h-[18px]" onClick={() => { playSound('click'); useUiStore.getState().openModal('deck'); }}>
            <PixelSprite sprite={ICONS.deck} tint={INK.orange} />
          </PxButton>
        )}
        {(collection || editor) && <span className="w-[1px] mx-[2px] self-stretch" style={{ background: 'rgba(185,207,200,0.15)' }} />}
        <IconButton icon={ICONS.info} aria-label={t.aria_rules} onClick={() => { playSound('click'); useUiStore.getState().openModal('rules'); }} />
        <IconButton icon={ICONS.trophy} aria-label={t.aria_stats} onClick={() => { playSound('click'); useUiStore.getState().openModal('stats'); }} />
        <IconButton icon={ICONS.gear} aria-label={t.aria_settings} onClick={() => { playSound('click'); useUiStore.getState().openModal('settings'); }} />
        {debug && (
          <PxButton aria-label="debug" className="w-[18px] h-[18px] font-display" style={{ fontSize: 7, color: 'var(--ink-volt)' }}
            onClick={() => { playSound('click'); useUiStore.getState().openModal('debug'); }}>DB</PxButton>
        )}
      </div>
      {/* Arriba a la izquierda, el logo en pequeño */}
      <Logo x={6} y={6} size={logoSize} align="start" />

      {/* Acción principal (ancha, con el contexto debajo del verbo) y, si hay, continuar partida */}
      <motion.div className="absolute z-30 flex flex-col items-stretch gap-[4px]" style={{ left: ctaBox.x, bottom: ctaBox.bottom, width: ctaBox.w }}
        initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: revealing ? 0.9 : 1, opacity: revealing ? 0 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 16, delay: revealing ? 0 : 0.5 }}>
        {/* Qué cambia en la revancha */}
        {canRematch && !revealing && (
          <span className="t-micro text-center" style={{ color: 'var(--ink-mint)' }}>{t[`rematch_hint_${level}` as keyof Translations]}</span>
        )}
        <PxButton tone="yellow" onClick={() => handleStartGame(canRematch)} disabled={locked || revealing}
          className={clsx('w-full flex-col gap-[1px] overflow-hidden', locked && 'opacity-50')}
          style={{ height: ctaBox.h, ...(castleSel ? { boxShadow: '0 0 0 1px var(--ink-crimson), 0 0 10px rgba(255,31,75,0.6)' } : {}) }}>
          <span className="text-title" style={{ fontSize: ctaBox.titleSize, lineHeight: '13px' }}>{cta.title}</span>
          {cta.sub && <span className="t-micro normal-case" style={{ color: 'rgba(11,13,12,0.75)' }}>{cta.sub}</span>}
        </PxButton>
        {/* El Bosque: duelos contra quien salga de entre los árboles (debajo de la acción principal, más estrecho: es lo secundario) */}
        {showForest && (
          <motion.div className="self-center" style={{ width: '72%' }} initial={awaken ? { y: 30, opacity: 0, scale: 0.6 } : false} animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: awaken ? 0.2 : 0 }}>
            <PxButton tone="amber" aria-label="forest" disabled={revealing} className="w-full flex-col gap-[1px] overflow-hidden" style={{ height: ctaBox.h }}
              onClick={() => { playSound('click'); useGameStore.getState().enterForest(); }}>
              <span className="text-title" style={{ fontSize: ctaBox.titleSize, lineHeight: '13px' }}>{t.forest_button}</span>
              <span className="t-micro normal-case" style={{ color: 'rgba(11,13,12,0.75)' }}>{t.forest_button_sub}</span>
            </PxButton>
          </motion.div>
        )}
        {hasSave && (
          <PxButton size="md" onClick={() => { playSound('click'); resumeGame(); }}>{t.continue_game}</PxButton>
        )}
      </motion.div>

      {/* El Bosque despierta: se anuncia por fases la primera vez (o desde depuración) */}
      {awakening && <ForestAwaken replay={!!forestReplay} onDone={() => { setAwaken(true); useUiStore.getState().setForestReplay(false); }} />}
      {/* Mientras se cuenta lo nuevo, nada responde */}
      {revealing && <div aria-label="map reveal" className="absolute inset-0 z-[500]" onClickCapture={e => e.stopPropagation()} />}
    </div>
  );
};
