import { CSSProperties, memo, useCallback } from 'react';
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

// --- PANEL DEL RIVAL (arriba a la izquierda) ---
export const RivalPanel = () => {
  const t = useTranslations();
  const { lives, deckCount, handCount } = usePlayerHud('opponent');
  return (
    <Panel title={t.rival} band={TEAM_BAND.opponent} className="absolute" style={{ left: 4, top: 4, width: 62, height: 62 }} bodyClassName="px-[4px] pt-[3px] flex flex-col gap-[3px]">
      <Lives lives={lives} />
      <div className="flex h-[11px]">
        {Array.from({ length: handCount }, (_, i) => (
          <MiniBack key={i} owner="opponent" style={{ marginLeft: i === 0 ? 0 : -3 }} />
        ))}
      </div>
      <DeckCount owner="opponent" count={deckCount} />
    </Panel>
  );
};

// --- PANEL DEL JUGADOR (abajo a la izquierda) ---
export const PlayerPanel = () => {
  const t = useTranslations();
  const { lives, deckCount } = usePlayerHud('player');
  return (
    <Panel title={t.you} band={TEAM_BAND.player} className="absolute" style={{ left: 4, top: 230, width: 62, height: 54 }} bodyClassName="px-[4px] pt-[3px] flex flex-col gap-[4px]">
      <Lives lives={lives} />
      <DeckCount owner="player" count={deckCount} />
    </Panel>
  );
};

// --- MANO DEL JUGADOR ---
const HAND_AREA = { x: 72, y: 226, w: 236 };
const HAND_GAP = 4;

interface HandCardProps {
  card: CardType;
  x: number;
  isSelected: boolean;
  canPlay: boolean;
  onSelect: (id: string) => void;
}

const HandCard = memo(({ card, x, isSelected, canPlay, onSelect }: HandCardProps) => {
  const handleClick = useCallback(() => onSelect(card.id), [onSelect, card.id]);
  return (
    <motion.div
      className="absolute"
      style={{ top: HAND_AREA.y, zIndex: isSelected ? 50 : undefined }}
      // Robar: llega desde el mazo (derecha) con un arco corto y rebote
      initial={{ left: HAND_AREA.x + HAND_AREA.w, y: -24, opacity: 0 }}
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
  // Las cartas se solapan si no caben en el hueco
  const step = hand.length > 1 ? Math.min(CARD_SIZE.width + HAND_GAP, Math.floor((HAND_AREA.w - CARD_SIZE.width) / (hand.length - 1))) : 0;
  const total = CARD_SIZE.width + step * Math.max(0, hand.length - 1);
  const startX = HAND_AREA.x + Math.floor((HAND_AREA.w - total) / 2);

  return (
    <AnimatePresence>
      {hand.map((card, i) => (
        <HandCard key={card.id} card={card} x={startX + i * step} isSelected={selectedCardId === card.id} canPlay={canPlay} onSelect={onSelectCard} />
      ))}
    </AnimatePresence>
  );
};
