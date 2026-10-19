import { Home as HomeIcon } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useUiStore } from '@/store/useUiStore';
import { useTranslations } from '@/lib/i18n';
import { playSound } from '@/lib/sounds';
import { isBoardEmpty } from '@/lib/game-utils';
import { COLORS } from '@/lib/constants';
import { DeckCounter, Lives, PlayerLabel } from './HudParts';

export const OpponentHeader = () => {
  const t = useTranslations();
  const { deckCount, handCount, lives } = useGameStore(useShallow(s => ({
    deckCount: s.opponent.deck.length,
    handCount: s.opponent.hand.length,
    lives: s.opponent.lives,
  })));

  const handleHomeClick = () => {
    playSound('click');
    // Solo pedimos confirmación si ya hay progreso en la partida
    const { roundNumber, player, exitToMenu } = useGameStore.getState();
    if (roundNumber > 1 || !isBoardEmpty(player.board)) useUiStore.getState().openModal('exit');
    else exitToMenu();
  };

  return (
    <header className="flex-none h-14 sm:h-20 p-2 sm:p-4 flex justify-between items-center relative z-10 border-b-[3px] sm:border-b-[4px] border-black bg-[#ff590d] shadow-[0_4px_0_#000] sm:shadow-[0_6px_0_#000]">
      <div className="flex items-center relative gap-3 sm:gap-4">
        <button onClick={handleHomeClick} className="bg-white p-1.5 sm:p-2 rounded-md border-[2px] sm:border-[3px] border-black shadow-[2px_2px_0_#000] sm:shadow-[3px_3px_0_#000] active:translate-y-1 active:shadow-none hover:bg-gray-100 transition-all scale-75 sm:scale-100 origin-left">
          <HomeIcon className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3px]" />
        </button>
        <div className="flex gap-2 sm:gap-4 items-center pl-0 sm:pl-2 scale-75 sm:scale-100 origin-left">
          <DeckCounter count={deckCount} color={COLORS.opponent} />
          <div className="flex -space-x-4 sm:-space-x-7 pl-1 sm:pl-2">
            {Array.from({ length: handCount }, (_, i) => (
              <div key={i} className="w-6 h-8 sm:w-10 sm:h-14 bg-[#ff590d] rounded-sm border-[2px] sm:border-[3px] border-black shadow-[2px_2px_0_#000] sm:shadow-[3px_3px_0_#000] relative pattern-diagonal-lines-sm text-black/30" style={{ zIndex: i, transform: `rotate(${(i - 1) * 8}deg)` }} />
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 sm:gap-4 scale-75 sm:scale-100 origin-right">
        <Lives lives={lives} lostFirst />
        <PlayerLabel>{t.rival}</PlayerLabel>
      </div>
    </header>
  );
};
