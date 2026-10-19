import { memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useTranslations } from '@/lib/i18n';
import { COLORS } from '@/lib/constants';
import { Card as CardType } from '@/types';
import { Card } from './Card';
import { DeckCounter, Lives, PlayerLabel } from './HudParts';

/** Inclinación "aleatoria" pero estable por carta (en [-3, 3) grados) */
const tiltFor = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(hash) % 600) / 100 - 3;
};

interface HandCardProps {
  card: CardType;
  isSelected: boolean;
  canPlay: boolean;
  onSelect: (id: string) => void;
}

const HandCard = memo(({ card, isSelected, canPlay, onSelect }: HandCardProps) => {
  const handleClick = useCallback(() => onSelect(card.id), [onSelect, card.id]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 100, rotate: 15 }}
      animate={{ opacity: 1, y: 0, rotate: tiltFor(card.id) }}
      exit={{ opacity: 0, y: 50 }}
      transition={{ duration: 0.2 }}
      whileHover={canPlay ? { y: -20, scale: 1.1, rotate: 0, transition: { duration: 0.1 } } : {}}
      className="h-[90%] aspect-[2/3] origin-bottom transition-all filter drop-shadow-[2px_2px_0_#000] sm:drop-shadow-[4px_4px_0_#000]"
    >
      <Card card={card} onClick={handleClick} isSelected={isSelected} isInHand />
    </motion.div>
  );
});
HandCard.displayName = 'HandCard';

interface PlayerFooterProps {
  selectedCardId: string | null;
  canPlay: boolean;
  onSelectCard: (id: string) => void;
}

export const PlayerFooter = ({ selectedCardId, canPlay, onSelectCard }: PlayerFooterProps) => {
  const t = useTranslations();
  const { hand, deckCount, lives } = useGameStore(useShallow(s => ({
    hand: s.player.hand,
    deckCount: s.player.deck.length,
    lives: s.player.lives,
  })));

  return (
    <section className="flex-none h-16 sm:h-28 bg-[#8e0dff] border-t-[3px] sm:border-t-[4px] border-black relative z-20 px-2 sm:px-4 grid grid-cols-3 items-center shadow-[0_-6px_0_#000]">
      <div className="flex items-center gap-1 sm:gap-4 pl-1 sm:pl-4 relative scale-75 sm:scale-100 origin-left">
        <PlayerLabel>{t.you}</PlayerLabel>
        <Lives lives={lives} />
      </div>
      <div className="flex justify-center items-center h-full pb-2 sm:pb-4 z-30 col-span-1">
        <div className="flex justify-center gap-1 sm:gap-2 h-16 sm:h-24 w-full items-center">
          <AnimatePresence>
            {hand.map(card => (
              <HandCard key={card.id} card={card} isSelected={selectedCardId === card.id} canPlay={canPlay} onSelect={onSelectCard} />
            ))}
          </AnimatePresence>
        </div>
      </div>
      <div className="flex items-center justify-end pl-1 sm:pl-4 pr-2 sm:pr-2">
        <DeckCounter count={deckCount} color={COLORS.player} className="mr-1 sm:mr-0" />
      </div>
    </section>
  );
};
