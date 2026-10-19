import { CSSProperties, memo, ReactNode, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useTranslations } from '@/lib/i18n';
import { STARTING_LIVES } from '@/lib/constants';
import { CARD_SIZE, steps } from '@/theme/tokens';
import { Card as CardType, Owner } from '@/types';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { Panel } from '@/components/pixel/ui';
import { CARD_BACK_TILE, patternUri } from '@/components/pixel/patterns';
import { HEART, HEART_LOST } from '@/components/pixel/sprites';
import { useGameLayout } from '@/components/pixel/Stage';
import { Rect } from '@/theme/layout';
import { Card } from './Card';

// --- PIEZAS DEL HUD ---

const Lives = ({ lives }: { lives: number }) => (
  <div className="flex gap-[1px]">
    {Array.from({ length: STARTING_LIVES }, (_, i) => (
      <PixelSprite key={i} sprite={i < lives ? HEART : HEART_LOST} />
    ))}
  </div>
);

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
    <span>x{count}</span>
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
    {Array.from({ length: count }, (_, i) => (
      <MiniBack key={i} owner="opponent" style={{ marginLeft: i === 0 ? 0 : -3 }} />
    ))}
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
        <Lives lives={lives} />
        <RivalHand count={handCount} />
        <div className="ml-auto"><DeckCount owner="opponent" count={deckCount} /></div>
      </CompactPanel>
    );
  }
  return (
    <Panel title={t.rival} band={TEAM_BAND.opponent} className="absolute" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} bodyClassName="px-[4px] pt-[3px] flex flex-col gap-[3px]">
      <Lives lives={lives} />
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
        <Lives lives={lives} />
        <div className="ml-auto"><DeckCount owner="player" count={deckCount} /></div>
      </CompactPanel>
    );
  }
  return (
    <Panel title={t.you} band={TEAM_BAND.player} className="absolute" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} bodyClassName="px-[4px] pt-[3px] flex flex-col gap-[4px]">
      <Lives lives={lives} />
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
  isSelected: boolean;
  canPlay: boolean;
  onSelect: (id: string) => void;
}

const HandCard = memo(({ card, x, y, fromX, isSelected, canPlay, onSelect }: HandCardProps) => {
  const handleClick = useCallback(() => onSelect(card.id), [onSelect, card.id]);
  return (
    <motion.div
      className="absolute"
      style={{ top: y, zIndex: isSelected ? 50 : undefined }}
      // Robar: llega desde el mazo (derecha) con un arco corto y rebote
      initial={{ left: fromX, y: -24, opacity: 0 }}
      animate={{ left: x, y: isSelected ? -8 : 0, opacity: 1 }}
      exit={{ y: -16, opacity: 0, transition: { duration: 0.1, ease: steps(2) } }}
      transition={{ duration: 0.2, ease: steps(5) }}
      whileHover={canPlay && !isSelected ? { y: -3, transition: { duration: 0.05 } } : undefined}
    >
      <div className={clsx(isSelected && 'anim-bob')}>
        {/* Sombra proyectada abajo-derecha */}
        <div className="absolute" style={{ left: 2, top: 3, width: CARD_SIZE.width, height: CARD_SIZE.height, background: 'var(--c-shadow)' }} />
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
        <HandCard key={card.id} card={card} x={startX + i * step} y={area.y} fromX={area.x + area.w} isSelected={selectedCardId === card.id} canPlay={canPlay} onSelect={onSelectCard} />
      ))}
    </AnimatePresence>
  );
};
