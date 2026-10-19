import { clsx } from 'clsx';
import { STARTING_LIVES } from '@/lib/constants';

/** Corazones de vida. `lostFirst` pinta primero los corazones perdidos (lado rival). */
export const Lives = ({ lives, lostFirst = false }: { lives: number; lostFirst?: boolean }) => (
  <div className="flex text-xl sm:text-4xl gap-0.5 sm:gap-1 drop-shadow-[1px_1px_0_#000] sm:drop-shadow-[2px_2px_0_#000]">
    {Array.from({ length: STARTING_LIVES }, (_, i) => {
      const alive = lostFirst ? i >= STARTING_LIVES - lives : i < lives;
      return (
        <span key={i} className={alive ? "text-white scale-110" : "text-black/40 grayscale"}>
          {alive ? '❤️' : '💔'}
        </span>
      );
    })}
  </div>
);

/** Contador de cartas que quedan en el mazo */
export const DeckCounter = ({ count, color, className }: { count: number; color: string; className?: string }) => (
  <div
    className={clsx("relative w-8 h-10 sm:w-12 sm:h-16 rounded-md border-[2px] sm:border-[3px] border-black flex items-center justify-center shadow-[2px_2px_0_#000] sm:shadow-[4px_4px_0_#000]", className)}
    style={{ backgroundColor: color }}
  >
    <span className="z-10 font-black text-white text-base sm:text-xl drop-shadow-[1px_1px_0_#000] sm:drop-shadow-[2px_2px_0_#000]">{count}</span>
  </div>
);

export const PlayerLabel = ({ children }: { children: string }) => (
  <span className="text-xl sm:text-4xl text-white font-black uppercase tracking-wider drop-shadow-[1px_1px_0_#000] sm:drop-shadow-[2px_2px_0_#000]">{children}</span>
);
