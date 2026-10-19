import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { playSfx } from '@/lib/sounds';
import { ACTIVE_THEME } from '@/themes';
import { Board } from '@/components/game/Board';
import { Hand, PlayerPanel, RivalPanel, Sidebar } from '@/components/game/Hud';
import { ActionButton, MenuButtons, RoundAnnouncer, TurnBox } from '@/components/game/GameControls';
import { FxLayer } from '@/components/fx/FxLayer';
import { AmbientDust, LowHealth } from '@/components/fx/Ambient';
import { Modals } from '@/components/modals/Modals';

const { Backdrop } = ACTIVE_THEME;

export const GameScreen = () => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const { canPlay, placeCard, lowHealth } = useGameStore(useShallow(s => ({
    canPlay: s.phase === 'placement' && s.turn === 'player' && !s.player.isPassed,
    placeCard: s.placeCard,
    lowHealth: s.player.lives === 1 && s.phase !== 'end',
  })));

  const handleSelectCard = useCallback((id: string) => {
    if (!canPlay) return;
    const deselect = selectedCardId === id;
    playSfx(deselect ? 'deselect' : 'select');
    setSelectedCardId(deselect ? null : id);
  }, [canPlay, selectedCardId]);

  const handleSlotClick = useCallback((slotIndex: number) => {
    if (!selectedCardId) return;
    placeCard(selectedCardId, slotIndex);
    setSelectedCardId(null);
  }, [selectedCardId, placeCard]);

  // Capas: fondo → tablero 3D (diorama + cartas + efectos) → interfaz → efectos de UI → modales
  return (
    <div className="absolute inset-0">
      <Backdrop />
      <AmbientDust />
      <Board selectedCardId={selectedCardId} onSlotClick={handleSlotClick} />
      <Sidebar />
      <RivalPanel />
      <PlayerPanel />
      <MenuButtons />
      <TurnBox />
      <ActionButton canPlay={canPlay} />
      <Hand selectedCardId={selectedCardId} canPlay={canPlay} onSelectCard={handleSelectCard} />
      <FxLayer layer="ui" />
      <RoundAnnouncer />
      <LowHealth active={lowHealth} />
      <Modals />
    </div>
  );
};
