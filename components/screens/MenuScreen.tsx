import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { useUiStore } from '@/store/useUiStore';
import { useTranslations } from '@/lib/i18n';
import { playSound } from '@/lib/sounds';
import { consumeFirstPlay } from '@/lib/stats';
import { TIMINGS } from '@/lib/constants';
import { Difficulty } from '@/types';

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

export const MenuScreen = () => {
  const t = useTranslations();
  const { difficulty, setDifficulty, startGame } = useGameStore(useShallow(s => ({
    difficulty: s.difficulty,
    setDifficulty: s.setDifficulty,
    startGame: s.startGame,
  })));

  // Empieza la partida y, si es la primera vez, abre el tutorial
  const handleStartGame = () => {
    playSound('click');
    startGame();
    if (consumeFirstPlay()) {
      setTimeout(() => useUiStore.getState().openModal('rules'), TIMINGS.rulesOnFirstGame);
    }
  };

  return (
    <main className="h-svh w-full flex items-center justify-center bg-[#F7F5E6] relative select-none font-comic pattern-grid-lg text-black">
      <div className="flex flex-col gap-6 w-full max-w-md px-4">
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={handleStartGame}
          className="bg-white p-8 rounded-lg border-[6px] border-black shadow-[12px_12px_0_#000] text-center hover:bg-orange-300 transition-colors cursor-pointer"
        >
          <h1 className="text-6xl font-black text-[#8e0dff] drop-shadow-[3px_3px_0_#000] uppercase">{t.play}</h1>
        </motion.button>

        <div className="bg-white p-6 rounded-lg border-[6px] border-black shadow-[12px_12px_0_#000] flex flex-col items-center gap-4">
          <h2 className="text-3xl font-black text-[#ff590d] uppercase drop-shadow-[2px_2px_0_#000]">{t.difficulty}</h2>
          <div className="flex justify-between w-full gap-2">
            {DIFFICULTIES.map(d => (
              <button
                key={d}
                onClick={() => { playSound('click'); setDifficulty(d); }}
                className={clsx(
                  "flex-1 py-3 rounded-md border-[4px] border-black font-black uppercase text-lg transition-all shadow-[4px_4px_0_#000] active:translate-y-[2px] active:shadow-[2px_2px_0_#000] text-black",
                  difficulty === d ? "bg-[#FF590D] scale-105" : "hover:bg-orange-300"
                )}
              >
                {t[d]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
};
