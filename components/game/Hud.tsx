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
    <motion.span key={count} initial={{ scale: 1.7, color: 'var(--c-glass)' }} animate={{ scale: 1, color: 'var(--c-outline)' }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}>
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
  /** Posición en el abanico: -1 (izquierda) … 0 (centro) … 1 (derecha) */
  fan: number;
  /** Retraso de entrada (cartas robadas a la vez llegan una tras otra) */
  enterDelay: number;
  isSelected: boolean;
  canPlay: boolean;
  onSelect: (id: string) => void;
}

const SPRING = { type: 'spring', stiffness: 380, damping: 24 } as const;

const HandCard = memo(({ card, x, y, fromX, fan, enterDelay, isSelected, canPlay, onSelect }: HandCardProps) => {
  const handleClick = useCallback(() => onSelect(card.id), [onSelect, card.id]);
  const [hovered, setHovered] = useState(false);
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
    if (!canPlay) return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 28);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 28);
  };
  const onLeave = () => {
    setHovered(false);
    animate(rx, 0, SPRING);
    animate(ry, 0, SPRING);
  };

  return (
    <motion.div
      className="absolute"
      style={{ top: y, zIndex: isSelected ? 60 : hovered ? 55 : undefined, rotateX: rx, rotateY: ry, transformPerspective: 260 }}
      // Robar: llega desde el mazo girando y se coloca en el abanico con un rebote
      initial={{ left: fromX, y: -40, rotate: 30, scale: 0.5, opacity: 0 }}
      animate={{ left: x, y: arcY, rotate, scale: isSelected ? 1.12 : hovered && canPlay ? 1.08 : 1, opacity: 1 }}
      exit={{ y: -30, scale: 0.8, opacity: 0, transition: { duration: 0.15 } }}
      transition={{ ...SPRING, delay: entered ? 0 : initialDelay }}
      onAnimationComplete={() => setEntered(true)}
      onPointerEnter={() => { setHovered(true); if (canPlay) playSfx('hover'); }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <div className={clsx(isSelected && 'anim-bob')}>
        {/* Sombra proyectada abajo-derecha: se aleja cuando la carta se levanta */}
        <motion.div className="absolute" style={{ width: CARD_SIZE.width, height: CARD_SIZE.height, background: 'var(--c-shadow)' }}
          animate={{ x: lifted ? 5 : 2, y: lifted ? 9 : 3, opacity: lifted ? 0.7 : 1 }} transition={SPRING} />
        <Card card={card} onClick={handleClick} isSelected={isSelected} isDisabled={!canPlay} />
      </div>
    </motion.div>
  );
});
HandCard.displayName = 'HandCard';

interface HandProps {
  selectedCardId: string | null;
  canPlay: boolean;
  onSelectCard: (id: string) => void;
}

export const Hand = ({ selectedCardId, canPlay, onSelectCard }: HandProps) => {
  const hand = useGameStore(s => s.player.hand);
  const area = useGameLayout().hand;
  // Las cartas se solapan si no caben en el hueco
  const step = hand.length > 1 ? Math.min(CARD_SIZE.width + HAND_GAP, Math.floor((area.w - CARD_SIZE.width) / (hand.length - 1))) : 0;
  const total = CARD_SIZE.width + step * Math.max(0, hand.length - 1);
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
          fan={hand.length > 1 ? (i - (hand.length - 1) / 2) / ((hand.length - 1) / 2) : 0}
          enterDelay={(i % 4) * 0.08}
          isSelected={selectedCardId === card.id}
          canPlay={canPlay}
          onSelect={onSelectCard}
        />
      ))}
    </AnimatePresence>
  );
};
