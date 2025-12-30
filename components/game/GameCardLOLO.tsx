import { Card as CardType } from '@/types';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { ArrowUp, ArrowUpLeft, ArrowUpRight, ArrowDown, ArrowDownLeft, ArrowDownRight } from 'lucide-react';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  isSelected?: boolean;
  className?: string;
  isInHand?: boolean;
}

export const Card = ({ card, onClick, isSelected, className, isInHand }: CardProps) => {
  const isJoker = card.rank === 'JOKER';
  const isAce = card.rank === 'A';
  const isDamage = card.isTakingDamage;
  const isVoided = card.isVoided;
  const isOpponent = card.owner === 'opponent';

  // --- ESTILOS BASE DOODLE ---
  // Ajuste: scale-90 en móvil para reducir un 10% visualmente si está en tablero
  const baseCardStyle = "relative w-full h-full aspect-[2/3] rounded-md border-[2px] sm:border-[3px] border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-between p-0.5 sm:p-1 cursor-pointer select-none transition-all overflow-hidden bg-white";
  
  // --- COLORES NUEVOS (INVERTIDOS) ---
  let debugBgColor = isOpponent ? '#ff590d' : '#8e0dff'; 
  let textColorClass = "text-white";

  if (isVoided) {
      debugBgColor = '#000000'; 
  } else if (isDamage) {
      debugBgColor = '#FF2222'; 
  } else if (isJoker && !isDamage && !isVoided) {
      debugBgColor = '#FDE047'; 
      textColorClass = "text-black";
  }

  const selectionStyle = isSelected ? "border-yellow-400 shadow-[4px_4px_0_#000] sm:shadow-[8px_8px_0_#000] -translate-y-1 sm:-translate-y-2 -translate-x-0.5 sm:-translate-x-1" : "hover:-translate-y-1 hover:shadow-[3px_3px_0_#000] sm:shadow-[6px_6px_0_#000]";

  const renderAttackIndicators = () => {
    if (isJoker || isAce || !card.isFaceUp || isVoided) return null;

    const iconClass = clsx(
        "w-3 h-3 sm:w-5 sm:h-5 stroke-[3px] sm:stroke-[4px]",
        (isJoker ? "text-black" : "text-white drop-shadow-[0_1px_0_#000] sm:drop-shadow-[0_2px_0_#000]")
    );
    
    let indicators;
    if (card.rank === 'Q') {
        indicators = isOpponent ? (
            <><ArrowDownLeft className={iconClass} /><ArrowDownRight className={iconClass} /></>
        ) : (
            <><ArrowUpLeft className={iconClass} /><ArrowUpRight className={iconClass} /></>
        );
    } else if (card.rank === 'K' || card.rank === 'J') {
        indicators = isOpponent ? (
            <><ArrowDownLeft className={iconClass} /><ArrowDown className={iconClass} /><ArrowDownRight className={iconClass} /></>
        ) : (
            <><ArrowUpLeft className={iconClass} /><ArrowUp className={iconClass} /><ArrowUpRight className={iconClass} /></>
        );
    } else {
        indicators = isOpponent ? <ArrowDown className={iconClass} /> : <ArrowUp className={iconClass} />;
    }

    return (
      <div className={clsx(
        "absolute left-0 w-full flex justify-center gap-0.5 pointer-events-none z-20",
        isOpponent ? "bottom-0.5 sm:bottom-1" : "top-0.5 sm:top-1"
      )}>
        {indicators}
      </div>
    );
  };

  // --- REVERSO (BACK) ---
  if (!card.isFaceUp) {
    return (
      <motion.div 
        layoutId={card.id}
        className={clsx(
          baseCardStyle,
          "pattern-diagonal-lines-sm text-black/20 justify-center !p-9", 
          className
        )}
        style={{ backgroundColor: isOpponent ? '#171616' : '#8e0dff' }}
      >
         <div className={clsx(
             "font-black text-3xl sm:text-6xl text-white drop-shadow-[1px_2px_0_#000]"
         )}>?</div>
      </motion.div>
    );
  }

  // --- ANVERSO (FRONT) ---
  return (
    <motion.div
      layoutId={card.id}
      onClick={onClick}
      animate={
          isDamage ? { rotate: [-2, 2, -2, 2, 0], scale: 1.1 } : 
          isVoided ? { scale: 0.9, rotate: 180 } : {}
      }
      transition={{ duration: 0.2 }}
      className={clsx(
        baseCardStyle,
        textColorClass,
        selectionStyle,
        isVoided && "pattern-diagonal-lines-sm",
        isJoker && !isDamage && !isVoided && "pattern-zigzag-sm",
        isDamage && "animate-[wiggle_0.2s_ease-in-out_infinite]",
        className
      )}
      style={{ backgroundColor: debugBgColor }}
    >
      {renderAttackIndicators()}

      <div className={clsx("font-black flex items-center justify-center h-full z-10 drop-shadow-[1px_1px_0_#000] sm:drop-shadow-[2px_2px_0_#000]", 
        isJoker ? "text-lg sm:text-2xl -rotate-90 tracking-widest" : "text-3xl sm:text-[45px]"
      )}>
        {isJoker ? 'JOKER' : card.rank}
      </div>

      {card.damageSource && (isDamage || isVoided) && (
          <motion.div 
              initial={{ opacity: 0, scale: 3, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className={clsx(
                  "absolute inset-0 w-full h-full flex justify-center items-center z-30 pointer-events-none",
              )}
          >
              <div className={clsx(
                  "w-10 h-10 sm:w-16 sm:h-16 rounded-full border-[2px] sm:border-[3px] border-black flex items-center justify-center shadow-[1px_1px_0_rgba(0,0,0,0.5)] sm:shadow-[2px_2px_0_rgba(0,0,0,0.5)]",
              )}
              style={{ backgroundColor: card.damageSource.owner === 'player' ? "#8e0dff" : "#ff590d" }}
              >
                  <span className={clsx(
                      "text-xl sm:text-3xl font-black text-white"
                  )}>
                      {card.damageSource.rank}
                  </span>
              </div>
          </motion.div>
      )}

    </motion.div>
  );
};