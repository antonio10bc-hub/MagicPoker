import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { haptic, playSfx } from '@/lib/sounds';
import { ACTIVE_THEME } from '@/themes';
import { Board } from '@/components/game/Board';
import { Hand, HandHandlers, PlayerPanel, RivalPanel, Sidebar } from '@/components/game/Hud';
import { CardInfo } from '@/components/game/CardInfo';
import { TutorialCoach, useTutorialGate } from '@/components/game/TutorialCoach';
import { ActionButton, MenuButtons, RoundAnnouncer, TurnBox } from '@/components/game/GameControls';
import { FxLayer } from '@/components/fx/FxLayer';
import { AmbientDust, LowHealth } from '@/components/fx/Ambient';

const { Backdrop } = ACTIVE_THEME;

export const GameScreen = () => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [infoCardId, setInfoCardId] = useState<string | null>(null);

  const { yourTurn, placeCard, lowHealth } = useGameStore(useShallow(s => ({
    yourTurn: s.phase === 'placement' && s.turn === 'player' && !s.player.isPassed,
    placeCard: s.placeCard,
    lowHealth: s.player.lives === 1 && s.phase !== 'end',
  })));
  // Tutorial: solo se juega en los pasos "play" (y solo la carta y el hueco que piden)
  const tutorial = useTutorialGate();
  const canPlay = yourTurn && (!tutorial.active || tutorial.step?.kind === 'play');
  const canStand = yourTurn && (!tutorial.active || tutorial.step?.kind === 'stand');

  const handleSelectCard = useCallback((id: string) => {
    if (!canPlay || (tutorial.cardId && id !== tutorial.cardId)) return;
    const deselect = selectedCardId === id;
    playSfx(deselect ? 'deselect' : 'select');
    if (!deselect) haptic('select');
    setSelectedCardId(deselect ? null : id);
  }, [canPlay, selectedCardId, tutorial.cardId]);

  const handleSlotClick = useCallback((slotIndex: number) => {
    if (!selectedCardId) return;
    placeCard(selectedCardId, slotIndex);
    setSelectedCardId(null);
  }, [selectedCardId, placeCard]);

  const handHandlers = useMemo<HandHandlers>(() => ({
    onSelect: handleSelectCard,
    onDragStart: id => {
      if (!canPlay) return;
      if (selectedCardId !== id) playSfx('select');
      setSelectedCardId(id);
    },
    onDragOverSlot: setDragOverSlot,
    onDrop: (id, slotIndex) => {
      setDragOverSlot(null);
      if (slotIndex === null) return;
      placeCard(id, slotIndex);
      setSelectedCardId(null);
    },
    onInfo: setInfoCardId,
  }), [handleSelectCard, canPlay, selectedCardId, placeCard]);

  // Capas: fondo → tablero 3D (diorama + cartas + efectos) → interfaz → efectos de UI → modales
  return (
    <div className="absolute inset-0">
      <Backdrop />
      <AmbientDust />
      <Board selectedCardId={selectedCardId} onSlotClick={handleSlotClick} dragOverSlot={dragOverSlot} onlySlot={tutorial.slot} />
      <Sidebar />
      <RivalPanel />
      <PlayerPanel />
      <MenuButtons />
      <TurnBox />
      <ActionButton canPlay={canStand} tutorial={tutorial.step?.kind === 'review'} />
      <Hand selectedCardId={selectedCardId} canPlay={canPlay} onlyCardId={tutorial.cardId} handlers={handHandlers} />
      <TutorialCoach />
      <CardInfo cardId={infoCardId} />
      <FxLayer layer="ui" />
      <RoundAnnouncer />
      <LowHealth active={lowHealth} />
    </div>
  );
};
