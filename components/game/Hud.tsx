import { CSSProperties, memo, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, animate, useAnimationControls, useMotionValue } from 'framer-motion';
import { clsx } from 'clsx';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useTranslations } from '@/lib/i18n';
import { STARTING_LIVES } from '@/lib/constants';
import { CARD_SIZE } from '@/theme/tokens';
import { Card as CardType, Owner } from '@/types';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { Panel } from '@/components/pixel/ui';
import { CARD_BACK_TILE, patternUri } from '@/components/pixel/patterns';
import { HEART, HEART_LOST } from '@/components/pixel/sprites';
import { useGameLayout } from '@/components/pixel/Stage';
import { Rect } from '@/theme/layout';
import { Card } from './Card';
import { cardOrigins } from './cardOrigins';
import { playSfx, vibrate } from '@/lib/sounds';

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
    <PixelSprite sprite={HEART} />
  </motion.div>
);

const Lives = ({ lives, owner }: { lives: number; owner: Owner }) => {
  const last = useRef(lives);
  const shake = useAnimationControls();
  const [lost, setLost] = useState<{ id: number; indices: number[] } | null>(null);

  useEffect(() => {
    const prev = last.current;
    last.current = lives;
    if (lives >= prev) return;
    // Golpe: sonido, vibración, sacudida del panel y corazones que salen volando
    playSfx(owner === 'player' ? 'hurt' : 'score');
    if (owner === 'player') vibrate([40, 30, 40]);
    shake.start({ x: [0, -3, 3, -2, 2, 0], transition: { duration: 0.4 } });
    const raf = requestAnimationFrame(() =>
      setLost({ id: Date.now(), indices: Array.from({ length: prev - lives }, (_, k) => lives + k) }));
    return () => cancelAnimationFrame(raf);
  }, [lives, owner, shake]);

  const critical = owner === 'player' && lives === 1;
  return (
    <motion.div animate={shake} className="relative flex gap-[1px]">
      {Array.from({ length: STARTING_LIVES }, (_, i) => (
        <motion.div
          key={`${i}-${i < lives}`}
          initial={i < lives ? false : { scale: 0.2 }}
          animate={critical && i < lives ? { scale: [1, 1.25, 1, 1.15, 1] } : { scale: 1 }}
          transition={critical ? { duration: 1.1, repeat: Infinity, times: [0, 0.12, 0.25, 0.37, 1] } : { type: 'spring', stiffness: 500, damping: 14 }}
        >
          <PixelSprite sprite={i < lives ? HEART : HEART_LOST} />
        </motion.div>
      ))}
      {lost?.indices.map(i => <FlyingHeart key={`${lost.id}-${i}`} index={i} />)}
    </motion.div>
  );
};

/** Dorso en miniatura (8×11) para mazo y mano rival */
const MiniBack = ({ owner, style }: { owner: Owner; style?: CSSProperties }) => (
  <div className="px-round" style={{
    width: 8, height: 11, backgroundImage: patternUri('card-back', CARD_BACK_TILE, owner), backgroundSize: '8px',
    boxShadow: 'inset 0 0 0 1px var(--c-outline)', ...style,
  }} />
);

const DeckCount = ({ owner, count }: { owner: Owner; count: number }) => (
  <div className="flex items-center gap-[3px]">
    <div className="relative" style={{ width: 10, height: 13 }}>
      <MiniBack owner={owner} style={{ position: 'absolute', left: 2, top: 0 }} />
      <MiniBack owner={owner} style={{ position: 'absolute', left: 0, top: 2 }} />
    </div>
    <motion.span key={count} initial={{ scale: 1.7, color: 'var(--c-gold)' }} animate={{ scale: 1, color: 'var(--c-white)' }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}>
      x{count}
    </motion.span>
  </div>
);

const TEAM_BAND: Record<Owner, string> = { player: 'var(--c-green)', opponent: 'var(--c-red)' };

const usePlayerHud = (owner: Owner) => useGameStore(useShallow(s => ({
  lives: s[owner].lives,
  deckCount: s[owner].deck.length,
  handCount: s[owner].hand.length,
})));

/** Panel horizontal (móvil): etiqueta del bando a la izquierda y datos en fila */
const CompactPanel = ({ label, owner, rect, children }: { label: string; owner: Owner; rect: Rect; children: ReactNode }) => (
  <div className="px-panel px-round absolute flex items-center gap-[6px] pr-[5px]" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
    <div className="text-outline h-full flex items-center px-[5px] shrink-0"
      style={{ background: TEAM_BAND[owner], boxShadow: 'inset 0 0 0 1px var(--c-outline), inset 1px 1px 0 1px rgba(255,255,255,0.35)' }}>
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

// --- PANEL DEL RIVAL ---
export const RivalPanel = () => {
  const t = useTranslations();
  const { rivalPanel: rect, compactPanels } = useGameLayout();
  const { lives, deckCount, handCount } = usePlayerHud('opponent');

  if (compactPanels) {
    return (
      <CompactPanel label={t.rival} owner="opponent" rect={rect}>
        <Lives lives={lives} owner="opponent" />
        <RivalHand count={handCount} />
        <div className="ml-auto"><DeckCount owner="opponent" count={deckCount} /></div>
      </CompactPanel>
    );
  }
  return (
    <Panel title={t.rival} band={TEAM_BAND.opponent} className="absolute" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} bodyClassName="px-[4px] pt-[3px] flex flex-col gap-[3px]">
      <Lives lives={lives} owner="opponent" />
      <RivalHand count={handCount} />
      <DeckCount owner="opponent" count={deckCount} />
    </Panel>
  );
};

// --- PANEL DEL JUGADOR ---
export const PlayerPanel = () => {
  const t = useTranslations();
  const { playerPanel: rect, compactPanels } = useGameLayout();
  const { lives, deckCount } = usePlayerHud('player');

  if (compactPanels) {
    return (
      <CompactPanel label={t.you} owner="player" rect={rect}>
        <Lives lives={lives} owner="player" />
        <div className="ml-auto"><DeckCount owner="player" count={deckCount} /></div>
      </CompactPanel>
    );
  }
  return (
    <Panel title={t.you} band={TEAM_BAND.player} className="absolute" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} bodyClassName="px-[4px] pt-[3px] flex flex-col gap-[4px]">
      <Lives lives={lives} owner="player" />
      <DeckCount owner="player" count={deckCount} />
    </Panel>
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

/** Centro visible de la carta arrastrada (o el puntero si aún no hay caja) */
const dragPoint = (el: HTMLElement | null, e: PointerEvent) => {
  if (!el) return { x: e.clientX, y: e.clientY };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

const LONG_PRESS_MS = 420;
const HOVER_INFO_MS = 650;

const SPRING = { type: 'spring', stiffness: 380, damping: 24 } as const;

const HandCard = memo(({ card, x, y, fromX, scale, fan, enterDelay, isSelected, canPlay, handlers }: HandCardProps) => {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const faceRef = useRef<HTMLDivElement>(null);
  const overSlot = useRef<number | null>(null);
  // Altura de la carta al empezar a arrastrar: se congela para que siga al dedo 1:1
  const [dragY, setDragY] = useState<number | null>(null);
  // Mantener pulsado (táctil) o dejar el ratón encima muestra la ficha de la carta
  const infoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const infoShown = useRef(false);
  const startInfo = (ms: number) => {
    if (infoTimer.current) clearTimeout(infoTimer.current);
    infoTimer.current = setTimeout(() => { infoShown.current = true; handlers.onInfo(card.id); }, ms);
  };
  const stopInfo = () => {
    if (infoTimer.current) clearTimeout(infoTimer.current);
    infoTimer.current = null;
    if (infoShown.current) handlers.onInfo(null);
  };
  useEffect(() => () => { if (infoTimer.current) clearTimeout(infoTimer.current); }, []);

  const handleClick = useCallback(() => {
    // Tras una pulsación larga no seleccionamos: solo se quería leer la ficha
    if (infoShown.current) { infoShown.current = false; return; }
    handlers.onSelect(card.id);
  }, [handlers, card.id]);
  const [entered, setEntered] = useState(false);
  // Inclinación 3D que sigue al puntero
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);

  useEffect(() => { cardOrigins.set(card.id, { x, y }); }, [card.id, x, y]);
  // El retraso solo importa al llegar a la mano (luego la carta puede cambiar de posición)
  const [initialDelay] = useState(enterDelay);
  useEffect(() => {
    const t = setTimeout(() => playSfx('draw', 0.7), initialDelay * 1000);
    return () => clearTimeout(t);
  }, [initialDelay]);

  const lifted = isSelected || (hovered && canPlay);
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
      data-hand-card
      className="absolute"
      style={{ top: y, zIndex: dragging ? 90 : isSelected ? 60 : hovered ? 55 : undefined, rotateX: rx, rotateY: ry, transformPerspective: 260 }}
      // Robar: llega desde el mazo girando y se coloca en el abanico con un rebote
      initial={{ left: fromX, y: -40, rotate: 30, scale: 0.5, opacity: 0 }}
      animate={{ left: x, y: dragY ?? arcY, rotate, scale: dragging ? 1 : isSelected ? 1.12 : hovered && canPlay ? 1.08 : 1, opacity: 1 }}
      exit={{ y: -30, scale: 0.8, opacity: 0, transition: { duration: 0.15 } }}
      transition={{ ...SPRING, delay: entered ? 0 : initialDelay }}
      onAnimationComplete={() => setEntered(true)}
      onPointerEnter={e => { setHovered(true); if (canPlay) playSfx('hover'); if (e.pointerType === 'mouse') startInfo(HOVER_INFO_MS); }}
      onPointerDown={e => { if (e.pointerType !== 'mouse') startInfo(LONG_PRESS_MS); }}
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
          if (slot !== null) { playSfx('hover'); vibrate(8); }
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
        style={{ touchAction: 'none' }}
      >
      {/* Balanceo continuo: las cartas nunca están quietas del todo */}
      <div ref={faceRef} style={{ transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: '0 0', width: CARD_SIZE.width, height: CARD_SIZE.height }}>
      <motion.div
        className={clsx(isSelected && 'anim-bob')}
        animate={{ rotate: [-1.6, 1.6, -1.6], y: [0, -1.5, 0] }}
        transition={{ duration: 2.6 + (card.value % 4) * 0.3, repeat: Infinity, ease: 'easeInOut', delay: (card.value % 7) * -0.4 }}
      >
        {/* Sombra proyectada abajo-derecha: se aleja cuando la carta se levanta */}
        <motion.div className="absolute" style={{ width: CARD_SIZE.width, height: CARD_SIZE.height, background: 'var(--c-shadow)' }}
          animate={{ x: lifted ? 5 : 2, y: lifted ? 9 : 3, opacity: lifted ? 0.7 : 1 }} transition={SPRING} />
        <Card card={card} onClick={handleClick} isSelected={isSelected} isDisabled={!canPlay} />
      </motion.div>
      </div>
      </motion.div>
    </motion.div>
  );
});
HandCard.displayName = 'HandCard';

interface HandProps {
  selectedCardId: string | null;
  canPlay: boolean;
  handlers: HandHandlers;
}

export const Hand = ({ selectedCardId, canPlay, handlers }: HandProps) => {
  const hand = useGameStore(s => s.player.hand);
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
          canPlay={canPlay}
          handlers={handlers}
        />
      ))}
    </AnimatePresence>
  );
};

// --- BARRA LATERAL (horizontal): marco oscuro que agrupa la información + contador de ronda ---
export const Sidebar = () => {
  const t = useTranslations();
  const { compactPanels } = useGameLayout();
  const round = useGameStore(s => s.roundNumber);
  if (compactPanels) return null;
  return (
    <>
      <div className="absolute px-panel-dark px-round" style={{ left: 1, top: 1, width: 68, height: 286, opacity: 0.85 }} />
      <div className="absolute px-inset flex flex-col items-center justify-center" style={{ left: 6, top: 96, width: 58, height: 44 }}>
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
