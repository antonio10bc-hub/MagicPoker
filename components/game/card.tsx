import { Card as CardType } from '@/types';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  isSelected?: boolean;
  className?: string;
}

export const Card = ({ card, onClick, isSelected, className }: CardProps) => {
  const isJoker = card.rank === 'JOKER';
  const isDamage = card.isTakingDamage;

  // Reverso
  if (!card.isFaceUp) {
    return (
      <motion.div 
        layoutId={card.id}
        className={clsx(
          "relative w-full h-full aspect-[2/3] bg-blue-900 rounded-lg border-2 border-slate-600 shadow-md flex items-center justify-center overflow-hidden",
          className
        )}
      >
         <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-400 to-blue-950"></div>
         <div className="text-blue-400/30 font-bold text-4xl">?</div>
      </motion.div>
    );
  }

  // Cara visible
  return (
    <motion.div
      layoutId={card.id}
      onClick={onClick}
      whileHover={!isDamage ? { y: -5 } : {}}
      animate={isDamage ? { x: [-2, 2, -2, 2, 0], backgroundColor: '#ef4444' } : {}} // Vibración y rojo si recibe daño
      transition={{ duration: 0.3 }}
      className={clsx(
        "relative w-full h-full aspect-[2/3] rounded-lg border shadow-md flex flex-col items-center justify-between p-1 sm:p-2 cursor-pointer select-none transition-all",
        // Estilos base vs Daño vs Joker
        isDamage ? "bg-red-500 border-red-700 text-white" : "bg-white border-slate-300 text-slate-900",
        isJoker && !isDamage && "bg-purple-100 border-purple-400 text-purple-900",
        isSelected ? "ring-4 ring-yellow-400 -translate-y-2" : "",
        className
      )}
    >
      {/* Esquina superior */}
      <div className="self-start text-xs sm:text-sm font-bold leading-none">
        {isJoker ? 'JOKER' : card.rank}
      </div>

      {/* Centro */}
      <div className={clsx("text-3xl sm:text-5xl font-bold")}>
        {isJoker ? '🤡' : card.rank}
      </div>

      {/* Esquina inferior */}
      <div className="self-end text-xs sm:text-sm font-bold leading-none rotate-180">
         {isJoker ? 'JOKER' : card.rank}
      </div>
    </motion.div>
  );
};