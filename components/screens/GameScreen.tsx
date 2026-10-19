import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { playSound } from '@/lib/sounds';
import { ACTIVE_THEME } from '@/themes';
import { Board } from '@/components/game/Board';
import { Hand, PlayerPanel, RivalPanel } from '@/components/game/Hud';
import { ActionButton, MenuButtons, TurnBox } from '@/components/game/GameControls';
import { Modals } from '@/components/modals/Modals';

const { Backdrop, Diorama } = ACTIVE_THEME;

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

  // Capas: fondo → diorama → cartas → interfaz → modales
  return (
    <div className="absolute inset-0">
      <Backdrop />
      <Diorama />
      <Board selectedCardId={selectedCardId} onSlotClick={handleSlotClick} />
      <RivalPanel />
      <PlayerPanel />
      <MenuButtons />
      <TurnBox />
      <ActionButton canPlay={canPlay} />
      <Hand selectedCardId={selectedCardId} canPlay={canPlay} onSelectCard={handleSelectCard} />
      <Modals />
    </div>
  );
};
