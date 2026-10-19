import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { playSound } from '@/lib/sounds';
import { Board } from '@/components/game/Board';
import { OpponentHeader } from '@/components/game/OpponentHeader';
import { PlayerFooter } from '@/components/game/PlayerFooter';
import { ActionButton, FloatingButtons, TurnBanner } from '@/components/game/GameControls';
import { Modals } from '@/components/modals/Modals';

export const GameScreen = () => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const { canPlay, placeCard } = useGameStore(useShallow(s => ({
    canPlay: s.phase === 'placement' && s.turn === 'player' && !s.player.isPassed,
    placeCard: s.placeCard,
  })));

  const handleSelectCard = useCallback((id: string) => {
    if (!canPlay) return;
    playSound('click', 0.5);
    setSelectedCardId(prev => (prev === id ? null : id));
  }, [canPlay]);

  const handleSlotClick = useCallback((slotIndex: number) => {
    if (!selectedCardId) return;
    placeCard(selectedCardId, slotIndex);
    setSelectedCardId(null);
  }, [selectedCardId, placeCard]);

  return (
    <main className="h-svh w-full flex flex-col bg-[#F7F5E6] text-black overflow-hidden relative select-none font-comic pattern-dots-sm">
      <Modals />
      <FloatingButtons />
      <ActionButton canPlay={canPlay} />
      <TurnBanner />
      <OpponentHeader />
      <Board selectedCardId={selectedCardId} onSlotClick={handleSlotClick} />
      <PlayerFooter selectedCardId={selectedCardId} canPlay={canPlay} onSelectCard={handleSelectCard} />
    </main>
  );
};
