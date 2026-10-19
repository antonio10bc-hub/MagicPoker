import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { BoardSlot, Owner } from '@/types';
import { Card } from './Card';

const slotStyle = "w-full h-full aspect-[2/3] relative flex items-center justify-center rounded-md transition-all border-[2px] sm:border-[4px] border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]";

const BURST_STYLES: Record<Owner, { rotate: number; ping: string; text: string }> = {
  opponent: { rotate: -45, ping: 'text-yellow-400', text: 'text-[#FF2222]' },
  player: { rotate: 45, ping: 'text-black', text: 'text-[#8e0dff]' },
};

/** Explosión "-N" sobre un hueco vacío que ha recibido daño directo */
const DamageBurst = ({ amount, owner }: { amount: number; owner: Owner }) => {
  const style = BURST_STYLES[owner];
  return (
    <motion.div initial={{ opacity: 0, scale: 0.5, rotate: style.rotate }} animate={{ opacity: 1, scale: 1.2, rotate: 0 }} exit={{ opacity: 0, scale: 0 }} className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="relative flex items-center justify-center">
        <span className={clsx("absolute inset-0 text-5xl scale-125 z-0 animate-ping", style.ping)}>💥</span>
        <span className={clsx("text-3xl font-black drop-shadow-[2px_2px_0_#000] relative z-10", style.text)} style={{ WebkitTextStroke: '1px black' }}>-{amount}</span>
      </div>
    </motion.div>
  );
};

interface BoardProps {
  selectedCardId: string | null;
  onSlotClick: (slotIndex: number) => void;
}

export const Board = ({ selectedCardId, onSlotClick }: BoardProps) => {
  const { playerBoard, opponentBoard, combat, isPlacementPhase } = useGameStore(useShallow(s => ({
    playerBoard: s.player.board,
    opponentBoard: s.opponent.board,
    combat: s.pendingCombatResult,
    isPlacementPhase: s.phase === 'placement',
  })));

  const isTargeting = !!selectedCardId && isPlacementPhase;
  const emptySlotInteractStyle = isTargeting
    ? "border-dashed border-[#8e0dff] bg-purple-100 animate-[wiggle_1s_ease-in-out_infinite] cursor-pointer hover:bg-purple-200"
    : "border-dashed border-black/40 bg-black/5";

  const renderRow = (board: BoardSlot[], owner: Owner) => {
    const hits = owner === 'player' ? combat?.playerEmptySlotsHit : combat?.opponentEmptySlotsHit;
    return (
      <div className="flex-1 grid grid-cols-4 gap-1 sm:gap-4 items-center justify-items-center">
        {board.map(slot => (
          <div key={`${owner}-${slot.index}`} className={slotStyle}>
            <AnimatePresence mode="popLayout">
              {slot.card ? (
                <Card key={slot.card.id} card={slot.card} className="z-10" />
              ) : owner === 'player' && (
                <motion.div key="empty" onClick={() => onSlotClick(slot.index)} className={clsx("absolute inset-0 rounded-md border-[2px] sm:border-[4px] transition-all duration-300 m-0.5 sm:m-1", emptySlotInteractStyle, !isPlacementPhase && "pointer-events-none opacity-50 border-solid")}>
                  {isTargeting && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl sm:text-4xl text-[#8e0dff] animate-bounce font-black">+</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            {hits?.[slot.index] !== undefined && <DamageBurst amount={hits[slot.index]} owner={owner} />}
          </div>
        ))}
      </div>
    );
  };

  return (
    <section className="flex-1 flex items-center justify-center p-1 sm:p-4 overflow-hidden min-h-0 relative py-2 sm:py-8">
      <div className="w-full max-w-lg bg-white rounded-lg border-[4px] sm:border-[6px] border-black shadow-[8px_8px_0_#000] sm:shadow-[12px_12px_0_#000] relative flex flex-col p-2 sm:p-4 shrink-0 scale-90 sm:scale-100 origin-center">
        {renderRow(opponentBoard, 'opponent')}
        <div className="h-2 sm:h-4 w-full my-1 sm:my-2 flex justify-center items-center relative border-t-[3px] sm:border-t-[4px] border-b-[3px] sm:border-b-[4px] border-black border-dashed bg-gray-200" />
        {renderRow(playerBoard, 'player')}
      </div>
    </section>
  );
};
