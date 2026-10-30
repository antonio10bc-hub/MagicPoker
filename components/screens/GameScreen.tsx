import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { haptic, playSfx } from '@/lib/sounds';
import { ACTIVE_THEME } from '@/themes';
import { Board } from '@/components/game/Board';
import { Hand, HandHandlers, PlayerPanel, RivalPanel, Sidebar } from '@/components/game/Hud';
import { CardInfo } from '@/components/game/CardInfo';
import { BossTaunt, SpyBubble } from '@/components/game/BossTaunt';
import { BossIntro } from '@/components/game/BossIntro';
import { CoinToss } from '@/components/game/CoinToss';
import { Phase2Scene } from '@/components/game/Phase2Scene';
import { HurtFlash, SlowMoLayer } from '@/components/game/Juice';
import { WildSealPicker } from '@/components/game/WildSealPicker';
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

  // Comodín de sello: antes de jugarlo se elige qué sello es
  const [wildPick, setWildPick] = useState<{ cardId: string; slot: number } | null>(null);
  const play = useCallback((cardId: string, slot: number) => {
    const card = useGameStore.getState().player.hand.find(c => c.id === cardId);
    const target = useGameStore.getState().player.board[slot]?.card;
    if (card?.wild) { if (target && !target.seal) setWildPick({ cardId, slot }); }
    else placeCard(cardId, slot);
  }, [placeCard]);

  const handleSlotClick = useCallback((slotIndex: number) => {
    if (!selectedCardId) return;
    play(selectedCardId, slotIndex);
    setSelectedCardId(null);
  }, [selectedCardId, play]);

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
      play(id, slotIndex);
      setSelectedCardId(null);
    },
    onInfo: setInfoCardId,
  }), [handleSelectCard, canPlay, selectedCardId, play]);

  // Capas: fondo → tablero 3D (diorama + cartas + efectos) → interfaz → efectos de UI → modales
  return (
    <div className="absolute inset-0">
      <Backdrop />
      <AmbientDust />
      <Board selectedCardId={selectedCardId} onSlotClick={handleSlotClick} dragOverSlot={dragOverSlot} onlySlot={tutorial.slot} />
      <Sidebar />
      <RivalPanel />
      <BossTaunt />
      <BossIntro />
      <CoinToss />
      <Phase2Scene />
      <HurtFlash />
      <SlowMoLayer />
      <SpyBubble />
      <PlayerPanel />
      <MenuButtons />
      <TurnBox />
      <ActionButton canPlay={canStand} tutorial={tutorial.step?.kind === 'review' || tutorial.step?.kind === 'note'} />
      <Hand selectedCardId={selectedCardId} canPlay={canPlay} onlyCardId={tutorial.cardId} handlers={handHandlers} />
      <TutorialCoach />
      <CardInfo cardId={infoCardId} />
      <FxLayer layer="ui" />
      <RoundAnnouncer />
      <LowHealth active={lowHealth} />
      {wildPick && <WildSealPicker onPick={seal => { placeCard(wildPick.cardId, wildPick.slot, seal); setWildPick(null); }} onCancel={() => setWildPick(null)} />}
    </div>
  );
};
