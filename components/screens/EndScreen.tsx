import { clsx } from 'clsx';
import Confetti from 'react-confetti';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useTranslations, Translations } from '@/lib/i18n';
import { playSound } from '@/lib/sounds';
import { GameResult } from '@/types';

const RESULT_UI: Record<GameResult, { title: keyof Translations; sub: keyof Translations; color: string }> = {
  win: { title: 'win', sub: 'win_sub', color: 'text-[#8e0dff]' },
  draw: { title: 'draw', sub: 'draw_sub', color: 'text-gray-700' },
  loss: { title: 'loss', sub: 'loss_sub', color: 'text-[#ff590d]' },
};

export const EndScreen = () => {
  const t = useTranslations();
  const { gameResult, startGame, exitToMenu } = useGameStore(useShallow(s => ({
    gameResult: s.gameResult ?? 'loss',
    startGame: s.startGame,
    exitToMenu: s.exitToMenu,
  })));
  const ui = RESULT_UI[gameResult];

  return (
    <main className="h-svh w-full flex items-center justify-center bg-[#F7F5E6] relative select-none font-comic pattern-grid-lg text-black overflow-hidden">
      {gameResult === 'win' && <Confetti numberOfPieces={300} recycle={false} />}
      <div className="bg-white p-8 rounded-lg border-[6px] border-black shadow-[12px_12px_0_#000] text-center max-w-md w-full mx-4 flex flex-col gap-6 relative overflow-hidden transform rotate-2 z-10">
        <h1 className={clsx("text-5xl sm:text-6xl font-black drop-shadow-[3px_3px_0_#000] uppercase", ui.color)}>{t[ui.title]}</h1>
        <h2 className="text-2xl font-bold border-b-4 border-black pb-4">{t[ui.sub]}</h2>
        <div className="flex flex-col gap-3">
          <button onClick={() => { playSound('click'); startGame(); }} className="w-full py-4 px-6 bg-yellow-400 hover:bg-yellow-300 rounded-md font-black text-2xl border-[4px] border-black shadow-[6px_6px_0_#000] active:translate-y-[4px] active:shadow-[2px_2px_0_#000] transition-all uppercase">{t.play_again}</button>
          <button onClick={() => { playSound('click'); exitToMenu(); }} className="w-full py-2 px-6 bg-gray-200 hover:bg-gray-300 rounded-md font-bold text-lg border-[4px] border-black shadow-[4px_4px_0_#000] active:translate-y-[2px] active:shadow-[2px_2px_0_#000] uppercase">{t.exit_menu}</button>
        </div>
      </div>
    </main>
  );
};
