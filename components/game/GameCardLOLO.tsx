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

  const baseCardStyle = "relative w-full h-full aspect-[2/3] rounded-md border-[2px] sm:border-[3px] border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-between p-0.5 sm:p-1 cursor-pointer select-none transition-all overflow-hidden bg-white";
  
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

    // Iconos un poco más pequeños si está en la mano para no saturar
    const iconClass = clsx(
        isInHand ? "w-3 h-3 sm:w-4 sm:h-4 stroke-[2px]" : "w-3 h-3 sm:w-5 sm:h-5 stroke-[3px] sm:stroke-[4px]",
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
          "pattern-diagonal-lines-sm text-black/20 justify-center items-center !p-0", 
          className
        )}
        style={{ backgroundColor: isOpponent ? '#171616' : '#8e0dff' }}
      >
         {/* AJUSTE TAMAÑO ?: Si está en mano, pequeño (3xl). Si no, gigante (7xl) */}
         <div className={clsx(
             "font-black text-white drop-shadow-[1px_2px_0_#000] leading-none",
             isInHand ? "text-3xl sm:text-4xl" : "text-7xl sm:text-6xl"
         )}>?</div>
      </motion.div>
    );
  }

  // --- ANVERSO (FRONT) ---
  
  // Lógica de tamaño de fuente
  // JOKER: Si está en mano -> text-lg. Si está en mesa -> text-4xl
  // NUMERO: Si está en mano -> text-2xl. Si está en mesa -> text-7xl (GIGANTE)
  const fontSizeClass = isJoker 
    ? (isInHand ? "text-lg sm:text-xl" : "text-4xl sm:text-2xl")
    : (isInHand ? "text-3xl sm:text-4xl" : "text-7xl sm:text-[45px]");

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
        isJoker ? "-rotate-90 tracking-widest" : "",
        fontSizeClass
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
                  "w-12 h-12 sm:w-16 sm:h-16 rounded-full border-[2px] sm:border-[3px] border-black flex items-center justify-center shadow-[1px_1px_0_rgba(0,0,0,0.5)] sm:shadow-[2px_2px_0_rgba(0,0,0,0.5)]",
              )}
              style={{ backgroundColor: card.damageSource.owner === 'player' ? "#8e0dff" : "#ff590d" }}
              >
                  <span className={clsx(
                      "text-2xl sm:text-3xl font-black text-white"
                  )}>
                      {card.damageSource.rank}
                  </span>
              </div>
          </motion.div>
      )}

    </motion.div>
  );
};