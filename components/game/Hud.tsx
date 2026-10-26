import { CSSProperties, memo, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, animate, useAnimationControls, useMotionValue } from 'framer-motion';
import { clsx } from 'clsx';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useUiStore } from '@/store/useUiStore';
import { useTranslations } from '@/lib/i18n';
import { STARTING_LIVES } from '@/lib/constants';
import { CARD_SIZE, INK } from '@/theme/tokens';
import { Card as CardType, Owner } from '@/types';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { Panel } from '@/components/pixel/ui';
import { CARD_BACK_TILE, patternUri } from '@/components/pixel/patterns';
import { HEART, HEART_LOST } from '@/components/pixel/sprites';
import { useGameLayout, useStage } from '@/components/pixel/Stage';
import { Rect } from '@/theme/layout';
import { Card } from './Card';
import { deckSummary, forecastFight } from './forecast';
import { ForestFigure } from './ForestFigure';
import { BossFigure } from './BossFigure';
import { Flinch } from './Juice';
import { BOSSES } from '@/lib/bosses';
import { haptic, playSfx } from '@/lib/sounds';

// --- PIEZAS DEL HUD ---

/** Corazón perdido que sale despedido */
const FlyingHeart = ({ index }: { index: number }) => (
  <motion.div
    className="absolute pointer-events-none"
    style={{ left: index * 10, top: 0 }}
    initial={{ y: 0, x: 0, rotate: 0, opacity: 1, scale: 1.4 }}
    animate={{ y: [0, -16, 10], x: [0, 4, 9], rotate: [0, 25, 90], opacity: [1, 1, 0], scale: [1.4, 1.2, 0.8] }}
    transition={{ duration: 0.75, times: [0, 0.4, 1], ease: 'easeOut' }}
  >
    <PixelSprite sprite={HEART} tint={INK.orange} />
  </motion.div>
);

/** Vidas. Las de más que te da el mercader del Castillo (por encima de las de partida) van en azul eléctrico. */
const Lives = ({ lives, owner, max = STARTING_LIVES }: { lives: number; owner: Owner; max?: number }) => {
  const last = useRef(lives);
  const shake = useAnimationControls();
  const [lost, setLost] = useState<{ id: number; indices: number[] } | null>(null);
  // Vidas recuperadas (sello de vida): brillan en verde un momento
  const [gained, setGained] = useState<{ from: number; to: number } | null>(null);

  useEffect(() => {
    const prev = last.current;
    last.current = lives;
    if (lives > prev) {
      playSfx('sparkle');
      const raf = requestAnimationFrame(() => setGained({ from: prev, to: lives }));
      const off = setTimeout(() => setGained(null), 1400);
      return () => { cancelAnimationFrame(raf); clearTimeout(off); };
    }
    if (lives === prev) return;
    // Golpe: sonido, vibración, sacudida del panel y corazones que salen volando
    playSfx(owner === 'player' ? 'hurt' : 'score');
    if (owner === 'player') haptic('lifeLost');
    shake.start({ x: [0, -3, 3, -2, 2, 0], transition: { duration: 0.4 } });
    const raf = requestAnimationFrame(() =>
      setLost({ id: Date.now(), indices: Array.from({ length: prev - lives }, (_, k) => lives + k) }));
    return () => cancelAnimationFrame(raf);
  }, [lives, owner, shake]);

  const critical = owner === 'player' && lives === 1;
  return (
    <motion.div animate={shake} className="relative flex gap-[1px]" data-lives={owner}>
      {Array.from({ length: max }, (_, i) => {
        const healed = !!gained && i >= gained.from && i < gained.to && i < lives;
        const extra = owner === 'player' && i >= STARTING_LIVES;
        return (
          <motion.div
            key={`${i}-${i < lives}`}
            className={critical && i < lives ? 'anim-heartbeat' : undefined}
            initial={i < lives ? (healed ? { scale: 2.2, y: -8 } : false) : { scale: 0.2 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 14 }}
          >
            {/* Vida: brasa que brilla; perdida: hueco apagado; recuperada: verde un momento */}
            <PixelSprite sprite={i < lives ? HEART : HEART_LOST} tint={healed ? INK.volt : i < lives ? (extra ? INK.azure : INK.orange) : INK.slate}
              className={healed ? 'bloom-volt-shape' : i < lives ? (extra ? 'bloom-azure-shape' : 'bloom-shape') : undefined} />
          </motion.div>
        );
      })}
      {lost?.indices.map(i => <FlyingHeart key={`${lost.id}-${i}`} index={i} />)}
      {/* Número de daño: "-N" que salta encima de los corazones */}
      {lost && (
        <motion.span key={`n-${lost.id}`} className="absolute font-display pointer-events-none text-outline"
          style={{ left: lives * 10 - 2, top: -12, fontSize: 12 + lost.indices.length * 2, color: owner === 'player' ? 'var(--ink-crimson)' : 'var(--ink-cream)' }}
          initial={{ y: 4, scale: 0.4, opacity: 0 }} animate={{ y: [4, -6, -10], scale: [0.4, 1.4, 1], opacity: [0, 1, 0] }}
          transition={{ duration: 1, times: [0, 0.25, 1] }}>
          -{lost.indices.length}
        </motion.span>
      )}
    </motion.div>
  );
};

/** Dorso en miniatura (8×11) para mazo y mano rival */
const MiniBack = ({ owner, style }: { owner: Owner; style?: CSSProperties }) => (
  <div className="px-round" style={{
    width: 8, height: 11, ...style,
    // Rival: brasa granulada; tú: silueta pizarra con un filo de niebla
    ...(owner === 'opponent'
      ? { backgroundImage: patternUri('card-back', CARD_BACK_TILE, owner), backgroundSize: '16px', boxShadow: '0 0 3px rgba(255,74,28,0.6)' }
      : { background: 'var(--ink-slate)', boxShadow: '0 0 0 1px rgba(185,207,200,0.35)' }),
  }} />
);

const DeckCount = ({ owner, count }: { owner: Owner; count: number }) => (
  <div className="flex items-center gap-[3px]">
    <div className="relative" style={{ width: 10, height: 13 }}>
      <MiniBack owner={owner} style={{ position: 'absolute', left: 2, top: 0 }} />
      <MiniBack owner={owner} style={{ position: 'absolute', left: 0, top: 2 }} />
    </div>
    <motion.span key={count} initial={{ scale: 1.7, color: '#F2652A' }} animate={{ scale: 1, color: '#EDEBE0' }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}>
      x{count}
    </motion.span>
  </div>
);

/** Etiqueta del bando: tú en silueta pizarra con letra crema; el rival, naranja que brilla */
const TEAM_BAND: Record<Owner, string> = { player: 'var(--ink-slate)', opponent: 'var(--ink-orange)' };
const TEAM_BAND_TEXT: Record<Owner, string> = { player: 'text-outline', opponent: 'text-ink bloom' };

const usePlayerHud = (owner: Owner) => useGameStore(useShallow(s => ({
  lives: s[owner].lives,
  maxLives: s[owner].maxLives ?? STARTING_LIVES,
  deckCount: s[owner].deck.length + (s[owner].sealDeck?.length ?? 0),
  handCount: s[owner].hand.length,
})));

/** Panel horizontal (móvil): etiqueta del bando a la izquierda y datos en fila */
const CompactPanel = ({ label, owner, rect, children }: { label: ReactNode; owner: Owner; rect: Rect; children: ReactNode }) => (
  <div className="px-panel px-round absolute flex items-center gap-[6px] pr-[5px]" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
    <div className={clsx(TEAM_BAND_TEXT[owner], 'h-full flex items-center px-[5px] pt-[1px] shrink-0 rounded-l-[3px]')}
      style={{ background: TEAM_BAND[owner] }}>
      {label}
    </div>
    {children}
  </div>
);

const RivalHand = ({ count }: { count: number }) => (
  <div className="flex h-[11px]">
    <AnimatePresence initial={false}>
      {Array.from({ length: count }, (_, i) => (
        <motion.div key={i} style={{ marginLeft: i === 0 ? 0 : -3 }}
          initial={{ y: -8, opacity: 0, rotate: -20 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: 10, opacity: 0, scale: 0.5 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
          <MiniBack owner="opponent" />
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

/** Botón invisible de pruebas sobre el icono del rival: 3 toques rápidos ganan la partida */
const SecretWin = ({ rect }: { rect: Rect }) => {
  const taps = useRef<number[]>([]);
  const debugWin = useGameStore(s => s.debugWin);
  const onTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter(t => now - t < 700), now];
    if (taps.current.length >= 3) { taps.current = []; debugWin(); }
  };
  return <button type="button" aria-hidden tabIndex={-1} className="absolute z-[5] opacity-0 cursor-default" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} onPointerDown={onTap} />;
};

// --- PANEL DEL RIVAL ---
export const RivalPanel = () => {
  const t = useTranslations();
  const { rivalPanel: rect, compactPanels } = useGameLayout();
  const { lives: realLives, maxLives, deckCount, handCount } = usePlayerHud('opponent');
  // Durante la fase 2 del Soberano el panel enseña las vidas que anima la cinemática
  const shown = useUiStore(s => s.rivalLivesShown);
  const lives = shown ?? realLives;
  // El boss de esta partida (en el tutorial, un rival sin nombre)
  // En el Bosque, quien salió de entre los árboles (en el color de su dificultad)
  const forest = useGameStore(s => s.forest);
  const boss = useGameStore(s => (s.tutorialStep === null && !s.forest ? BOSSES[s.bossIndex] : null));
  const name = forest ? t[`forest_${forest.id}` as keyof typeof t] : boss ? t[`boss_${boss.id}` as keyof typeof t] : t.rival;
  // En el Castillo: jefe evolucionado y el piso por el que vas
  const castle = useGameStore(s => s.castle);
  const floor = castle && (
    <span className="font-display glow-crimson" style={{ color: 'var(--ink-crimson)', fontSize: 9, lineHeight: '9px' }}>
      {castle.stage + 1}/{BOSSES.length}
    </span>
  );

  if (compactPanels) {
    return (
      <>
        <CompactPanel label={forest ? <Flinch><ForestFigure id={forest.id} tier={forest.tier} height={22} mode="shadow" /></Flinch>
          : boss ? <Flinch><BossFigure id={boss.id} height={22} dark glow={false} evolved={!!castle} /></Flinch> : t.rival} owner="opponent" rect={rect}>
          <Lives lives={lives} max={maxLives} owner="opponent" />
          <RivalHand count={handCount} />
          {floor}
          <div className="ml-auto"><DeckCount owner="opponent" count={deckCount} /></div>
        </CompactPanel>
        <SecretWin rect={{ ...rect, w: 36 }} />
      </>
    );
  }
  return (
    <>
      <Panel title={<span className="block overflow-hidden text-ellipsis" style={{ fontSize: name.length > Math.floor((rect.w - 10) / 6) ? 8 : 10 }}>{name}</span>} band={TEAM_BAND.opponent} titleClassName={TEAM_BAND_TEXT.opponent} className="absolute" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} bodyClassName="px-[4px] pt-[3px] flex flex-col gap-[3px]">
        {boss && <div className="absolute" style={{ right: 3, bottom: 2 }}><Flinch><BossFigure id={boss.id} height={26} evolved={!!castle} /></Flinch></div>}
        {forest && <div className="absolute" style={{ right: 3, bottom: 2 }}><Flinch><ForestFigure id={forest.id} tier={forest.tier} height={26} /></Flinch></div>}
        <Lives lives={lives} max={maxLives} owner="opponent" />
        <RivalHand count={handCount} />
        <DeckCount owner="opponent" count={deckCount} />
        {floor}
      </Panel>
      <SecretWin rect={rect} />
    </>
  );
};

// --- PANEL DEL JUGADOR ---
/**
 * Aviso de vida en peligro: cuántos golpes pueden llegarte a huecos vacíos con lo que
 * se ve ahora. Si los seguros bastan para acabar contigo, late "¡PELIGRO!".
 */
const DangerChip = ({ lives }: { lives: number }) => {
  const t = useTranslations();
  const { playerBoard, opponentBoard, placement } = useGameStore(useShallow(s => ({
    playerBoard: s.player.board, opponentBoard: s.opponent.board, placement: s.phase === 'placement',
  })));
  const { taken } = useMemo(() => forecastFight(playerBoard, opponentBoard), [playerBoard, opponentBoard]);
  const total = taken.sure + taken.maybe;
  const lethal = taken.sure >= lives || total >= lives;
  const warn = placement && total > 0 && lethal;
  useEffect(() => { if (warn) haptic('danger'); }, [warn]);
  return (
    <AnimatePresence>
      {placement && total > 0 && (
        <motion.div key="danger"
          className={clsx('flex items-center gap-[2px] px-[3px] h-[11px] rounded-[3px] font-display text-ink bloom', lethal && 'anim-throb')}
          style={{ background: lethal ? 'var(--ink-orange)' : 'var(--ink-ember)', fontSize: 10, paddingTop: 2 }}
          initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0, transition: { duration: 0.12 } }}
          transition={{ type: 'spring', stiffness: 500, damping: 18 }}>
          {lethal ? t.danger : <>{taken.sure > 0 && `-${taken.sure}`}{taken.maybe > 0 && <span style={{ opacity: taken.sure ? 0.7 : 1 }}>{taken.sure ? '+' : '-'}{taken.maybe}?</span>}</>}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/** Ficha del mazo: qué cartas te quedan, agrupadas por rango (no revela el orden) */
const DeckPeek = ({ anchor, onClose }: { anchor: Rect; onClose: () => void }) => {
  const t = useTranslations();
  const { width } = useStage();
  const deck = useGameStore(s => s.player.deck);
  const summary = useMemo(() => deckSummary(deck), [deck]);
  const w = Math.min(150, width - 8);
  return (
    <>
      <div className="absolute inset-0 z-[94]" onClick={onClose} />
      <motion.div className="px-panel px-round absolute z-[95] p-[5px]" data-popover
        style={{ left: Math.min(anchor.x, width - 4 - w), top: anchor.y - 4, width: w, translateY: '-100%' }}
        initial={{ opacity: 0, y: 8, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, transition: { duration: 0.12 } }}
        transition={{ type: 'spring', stiffness: 500, damping: 26 }} onClick={onClose}>
        <div className="mb-[4px]" style={{ color: 'var(--ink-teal)' }}>{t.deck_left} · {deck.length}</div>
        <div className="grid grid-cols-7 gap-[2px]">
          {summary.map(({ rank, count }) => (
            <div key={rank} className="flex flex-col items-center rounded-[2px] py-[2px]"
              style={{ background: count ? 'var(--ink-slate)' : 'transparent', opacity: count ? 1 : 0.35 }}>
              <span className="font-display" style={{ fontSize: rank === 'JOKER' ? 7 : 11, lineHeight: '11px', color: count ? 'var(--ink-cream)' : 'var(--ink-teal)' }}>
                {rank === 'JOKER' ? 'JKR' : rank}
              </span>
              <span className="font-display" style={{ fontSize: 9, lineHeight: '9px', color: count ? 'var(--ink-ember)' : 'var(--ink-teal)' }}>{count}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </>
  );
};

export const PlayerPanel = () => {
  const t = useTranslations();
  const { playerPanel: rect, compactPanels } = useGameLayout();
  const { lives, maxLives, deckCount } = usePlayerHud('player');
  const [peek, setPeek] = useState(false);
  const togglePeek = () => { playSfx(peek ? 'deselect' : 'open', 0.6); setPeek(p => !p); };
  const deck = (
    <button className="cursor-pointer" onClick={togglePeek} aria-label={t.aria_deck}>
      <DeckCount owner="player" count={deckCount} />
    </button>
  );
  const peekLayer = <AnimatePresence>{peek && <DeckPeek key="peek" anchor={rect} onClose={togglePeek} />}</AnimatePresence>;

  if (compactPanels) {
    return (
      <>
        <CompactPanel label={t.you} owner="player" rect={rect}>
          <Lives lives={lives} max={maxLives} owner="player" />
          <DangerChip lives={lives} />
          <div className="ml-auto">{deck}</div>
        </CompactPanel>
        {peekLayer}
      </>
    );
  }
  return (
    <>
      <Panel title={<div className="flex items-center justify-between"><span>{t.you}</span><DangerChip lives={lives} /></div>} band={TEAM_BAND.player} titleClassName={TEAM_BAND_TEXT.player} className="absolute" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} bodyClassName="px-[4px] pt-[3px] flex flex-col gap-[4px]">
        <Lives lives={lives} max={maxLives} owner="player" />
        <div>{deck}</div>
      </Panel>
      {peekLayer}
    </>
  );
};

// --- MANO DEL JUGADOR ---
const HAND_GAP = 4;

interface HandCardProps {
  card: CardType;
  x: number;
  /** Fila de la mano y punto desde el que llegan las cartas robadas */
  y: number;
  fromX: number;
  /** Escala de dibujo de la carta en la mano */
  scale: number;
  /** Posición en el abanico: -1 (izquierda) … 0 (centro) … 1 (derecha) */
  fan: number;
  /** Retraso de entrada (cartas robadas a la vez llegan una tras otra) */
  enterDelay: number;
  isSelected: boolean;
  canPlay: boolean;
  /** Halo que late: "juega esta" (tutorial) */
  hinted?: boolean;
  handlers: HandHandlers;
}

/** Interacciones de la mano: tocar, arrastrar a un hueco y mantener para ver la ficha */
export interface HandHandlers {
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragOverSlot: (slotIndex: number | null) => void;
  onDrop: (id: string, slotIndex: number | null) => void;
  onInfo: (id: string | null) => void;
}

/**
 * Hueco de destino para una carta arrastrada: el hueco libre (los botones llevan
 * data-slot) más cercano al centro de la carta, con un margen generoso alrededor de
 * cada hueco para no exigir puntería. Usa los rectángulos reales en pantalla, así
 * tiene en cuenta la inclinación 3D del tablero.
 */
const slotNear = (x: number, y: number): number | null => {
  let best: number | null = null;
  let bestD = Infinity;
  document.querySelectorAll<HTMLElement>('[data-slot]').forEach(el => {
    const r = el.getBoundingClientRect();
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    const d = Math.hypot(dx, dy);
    if (d <= r.width * 0.75 && d < bestD) { best = Number(el.dataset.slot); bestD = d; }
  });
  return best;
};

/** Punto que decide el hueco: con ratón, el cursor (en PC se apunta con él); con el
 *  dedo, el centro visible de la carta (el dedo la tapa) */
const dragPoint = (el: HTMLElement | null, e: PointerEvent) => {
  if (!el || e.pointerType === 'mouse') return { x: e.clientX, y: e.clientY };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

const LONG_PRESS_MS = 420;
/** Ratón quieto encima de una carta: la ficha sale algo tarde para no estorbar al agarrarla */
const HOVER_INFO_MS = 1000;

const SPRING = { type: 'spring', stiffness: 380, damping: 24 } as const;

const HandCard = memo(({ card, x, y, fromX, scale, fan, enterDelay, isSelected, canPlay, hinted, handlers }: HandCardProps) => {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const faceRef = useRef<HTMLDivElement>(null);
  const overSlot = useRef<number | null>(null);
  // Altura de la carta al empezar a arrastrar: se congela para que siga al dedo 1:1
  const [dragY, setDragY] = useState<number | null>(null);
  // Mantener pulsado (táctil) o dejar el ratón encima muestra la ficha de la carta
  const infoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const infoShown = useRef(false);
  // Solo la pulsación larga (táctil) "se come" el toque siguiente; la ficha por pasar
  // el ratón por encima no debe impedir hacer clic
  const infoByPress = useRef(false);
  const startInfo = (ms: number, press: boolean) => {
    if (infoTimer.current) clearTimeout(infoTimer.current);
    infoTimer.current = setTimeout(() => { infoShown.current = true; infoByPress.current = press; handlers.onInfo(card.id); }, ms);
  };
  const stopInfo = () => {
    if (infoTimer.current) clearTimeout(infoTimer.current);
    infoTimer.current = null;
    if (infoShown.current) handlers.onInfo(null);
  };
  useEffect(() => () => { if (infoTimer.current) clearTimeout(infoTimer.current); }, []);

  const handleClick = useCallback(() => {
    // Tras una pulsación larga no seleccionamos: solo se quería leer la ficha
    if (infoShown.current && infoByPress.current) { infoShown.current = false; infoByPress.current = false; return; }
    handlers.onSelect(card.id);
  }, [handlers, card.id]);
  const [entered, setEntered] = useState(false);
  // Inclinación 3D que sigue al puntero
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);

  // El retraso solo importa al llegar a la mano (luego la carta puede cambiar de posición)
  const [initialDelay] = useState(enterDelay);
  useEffect(() => {
    const t = setTimeout(() => playSfx('draw', 0.7), initialDelay * 1000);
    return () => clearTimeout(t);
  }, [initialDelay]);

  // La carta señalada por el tutorial se levanta y pasa al frente del abanico
  const lifted = isSelected || hinted || (hovered && canPlay);
  const rotate = lifted ? 0 : fan * 9;
  const arcY = lifted ? (isSelected ? -14 : -10) : Math.round(fan * fan * 5);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canPlay || dragging) return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 28);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 28);
  };
  const onLeave = () => {
    setHovered(false);
    stopInfo();
    animate(rx, 0, SPRING);
    animate(ry, 0, SPRING);
  };

  return (
    <motion.div
      data-hand-card={card.id}
      className="absolute"
      style={{ top: y, zIndex: dragging ? 90 : isSelected ? 60 : hinted ? 58 : hovered ? 55 : undefined, rotateX: rx, rotateY: ry, transformPerspective: 260 }}
      // Robar: llega desde el mazo girando y se coloca en el abanico con un rebote
      initial={{ left: fromX, y: -40, rotate: 30, scale: 0.5, opacity: 0 }}
      animate={{ left: x, y: dragY ?? arcY, rotate, scale: dragging ? 1 : isSelected ? 1.12 : hovered && canPlay ? 1.08 : 1, opacity: 1 }}
      // Al jugarse desaparece al instante: la carta que vuela a la mesa toma el relevo
      exit={{ opacity: 0, transition: { duration: 0 } }}
      transition={{ ...SPRING, delay: entered ? 0 : initialDelay }}
      onAnimationComplete={() => setEntered(true)}
      onPointerEnter={e => { setHovered(true); if (canPlay) playSfx('hover'); if (e.pointerType === 'mouse') startInfo(HOVER_INFO_MS, false); }}
      // Con ratón, pulsar quita la ficha (vas a jugarla); con el dedo, mantener la enseña
      onPointerDown={e => { if (e.pointerType !== 'mouse') startInfo(LONG_PRESS_MS, true); else stopInfo(); }}
      onPointerUp={() => { if (infoTimer.current) clearTimeout(infoTimer.current); if (infoShown.current) handlers.onInfo(null); }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {/* Arrastrar: la carta sigue al dedo y, al soltarla sobre un hueco, se juega */}
      <motion.div
        drag={canPlay}
        dragSnapToOrigin
        dragMomentum={false}
        dragElastic={1}
        // Al arrastrar se ajusta al tamaño de la mesa para ver bien el hueco de destino
        whileDrag={{ scale: 1.05 / scale, rotate: 0 }}
        onDragStart={() => {
          stopInfo();
          infoShown.current = false;
          setDragging(true);
          setDragY(arcY);
          rx.set(0); ry.set(0);
          handlers.onDragStart(card.id);
        }}
        onDrag={e => {
          const p = dragPoint(faceRef.current, e as PointerEvent);
          const slot = slotNear(p.x, p.y);
          if (slot === overSlot.current) return;
          overSlot.current = slot;
          // Pequeño "clic" al entrar en un hueco: confirma dónde caerá al soltar
          if (slot !== null) { playSfx('hover'); haptic('tick'); }
          handlers.onDragOverSlot(slot);
        }}
        onDragEnd={e => {
          const p = dragPoint(faceRef.current, e as PointerEvent);
          const slot = slotNear(p.x, p.y) ?? overSlot.current;
          overSlot.current = null;
          setDragging(false);
          setDragY(null);
          handlers.onDrop(card.id, slot);
        }}
        // Caja del tamaño visible de la carta: al crecer al arrastrar lo hace desde su
        // centro y la carta sigue bajo el cursor (o el dedo) donde se agarró
        style={{ touchAction: 'none', width: CARD_SIZE.width * scale, height: CARD_SIZE.height * scale, cursor: canPlay ? (dragging ? 'grabbing' : 'grab') : undefined }}
      >
      {/* Balanceo continuo: las cartas nunca están quietas del todo */}
      <div ref={faceRef} data-card-face style={{ transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: '0 0', width: CARD_SIZE.width, height: CARD_SIZE.height }}>
      <div
        className={isSelected ? 'anim-bob' : 'anim-sway'}
        style={{ animationDuration: isSelected ? undefined : `${2.6 + (card.value % 4) * 0.3}s`, animationDelay: `${(card.value % 7) * -0.4}s` }}
      >
        {/* Sombra proyectada abajo-derecha: se aleja cuando la carta se levanta */}
        <motion.div className="absolute" style={{ width: CARD_SIZE.width, height: CARD_SIZE.height, background: 'var(--c-shadow)' }}
          animate={{ x: lifted ? 5 : 2, y: lifted ? 9 : 3, opacity: lifted ? 0.7 : 1 }} transition={SPRING} />
        <Card card={card} onClick={handleClick} isSelected={isSelected} isDisabled={!canPlay} />
        {hinted && <div className="absolute inset-0 rounded-[3px] pointer-events-none anim-pulse"
          style={{ width: CARD_SIZE.width, height: CARD_SIZE.height, boxShadow: '0 0 0 1px var(--ink-cream), 0 0 10px 3px rgba(255,74,28,0.7)' }} />}
      </div>
      </div>
      </motion.div>
    </motion.div>
  );
});
HandCard.displayName = 'HandCard';

interface HandProps {
  selectedCardId: string | null;
  canPlay: boolean;
  /** Tutorial: la única carta que se puede jugar (se señala con un halo) */
  onlyCardId?: string;
  handlers: HandHandlers;
}

export const Hand = ({ selectedCardId, canPlay, onlyCardId, handlers }: HandProps) => {
  const hand = useGameStore(s => s.player.hand);
  // Una carta de sello necesita una carta propia sin sello en la mesa
  const canSeal = useGameStore(s => s.player.board.some(b => b.card && !b.card.seal));
  const area = useGameLayout().hand;
  const cardW = Math.round(CARD_SIZE.width * area.scale);
  // Las cartas se solapan si no caben en el hueco
  const step = hand.length > 1 ? Math.min(cardW + HAND_GAP, Math.floor((area.w - cardW) / (hand.length - 1))) : 0;
  const total = cardW + step * Math.max(0, hand.length - 1);
  const startX = area.x + Math.floor((area.w - total) / 2);

  return (
    <AnimatePresence>
      {hand.map((card, i) => (
        <HandCard
          key={card.id}
          card={card}
          x={startX + i * step}
          y={area.y}
          fromX={area.x + area.w}
          scale={area.scale}
          fan={hand.length > 1 ? (i - (hand.length - 1) / 2) / ((hand.length - 1) / 2) : 0}
          enterDelay={(i % 4) * 0.08}
          isSelected={selectedCardId === card.id}
          canPlay={canPlay && (!onlyCardId || card.id === onlyCardId) && (card.rank !== 'SEAL' || canSeal)}
          hinted={onlyCardId === card.id && selectedCardId !== card.id}
          handlers={handlers}
        />
      ))}
    </AnimatePresence>
  );
};

// --- BARRA LATERAL (horizontal): marco oscuro que agrupa la información + contador de ronda ---
export const Sidebar = () => {
  const t = useTranslations();
  const { compactPanels, sidebar, roundBox } = useGameLayout();
  const round = useGameStore(s => s.roundNumber);
  if (compactPanels) return null;
  return (
    <>
      <div className="absolute px-panel-dark px-round" style={{ left: sidebar.x, top: sidebar.y, width: sidebar.w, height: sidebar.h, opacity: 0.85 }} />
      <div className="absolute px-inset flex flex-col items-center justify-center" style={{ left: roundBox.x, top: roundBox.y, width: roundBox.w, height: roundBox.h }}>
        <span style={{ color: 'var(--c-ui-muted)' }}>{t.round}</span>
        <motion.span
          key={round}
          className="text-title text-outline"
          style={{ color: 'var(--c-orange)' }}
          initial={{ scale: 2.2, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 12 }}
        >
          {round}
        </motion.span>
      </div>
    </>
  );
};
