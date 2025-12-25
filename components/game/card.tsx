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
  const baseCardStyle = "relative w-full h-full aspect-[2/3] rounded-md border-[4px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-between p-1 cursor-pointer select-none transition-all overflow-hidden bg-white";
  
  let cardStyle = isOpponent 
    ? "bg-[#FF2222] text-white" 
    : "bg-[#0066FF] text-white";

  if (isVoided) {
      cardStyle = "bg-black text-white border-black pattern-diagonal-lines-sm";
  } else if (isDamage) {
      cardStyle = "bg-[#FF2222] text-white border-black animate-[wiggle_0.2s_ease-in-out_infinite]";
  }

  if (isJoker && !isDamage && !isVoided) {
      cardStyle = "bg-yellow-300 text-black border-black pattern-zigzag-sm";
  }

  const selectionStyle = isSelected ? "border-yellow-400 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] -translate-y-2 -translate-x-1" : "hover:-translate-y-1 hover:-translate-x-0.5 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]";

  const renderAttackIndicators = () => {
    if (isJoker || isAce || !card.isFaceUp || isVoided) return null;

    const iconClass = clsx(
        "w-5 h-5 sm:w-6 sm:h-6 stroke-[3px]",
        (isJoker ? "text-black" : "text-white drop-shadow-[0_2px_0_#000]")
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
        isOpponent ? "bottom-1" : "top-1"
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
          isOpponent ? "bg-[#FF2222]" : "bg-[#0066FF]",
          "pattern-diagonal-lines-sm text-black/20",
          // CAMBIO: justify-center y !p-0 para centrar perfectamente eliminando el padding base
          "justify-center !p-0", 
          className
        )}
      >
         <div className={clsx(
             "font-black text-5xl sm:text-6xl text-white drop-shadow-[3px_3px_0_#000]"
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
        cardStyle,
        selectionStyle,
        className
      )}
    >
      {renderAttackIndicators()}

      {/* SÍMBOLO CENTRAL */}
      <div className={clsx("font-black flex items-center justify-center h-full z-10 drop-shadow-[2px_2px_0_#000]", 
        isJoker ? "text-2xl sm:text-3xl -rotate-45 tracking-widest" : "text-[40px] sm:text-[50px]"
      )}>
        {isJoker ? 'JOKER' : card.rank}
      </div>

      {/* MARCA DE DAÑO (CICATRIZ) */}
      {card.damageSource && (isDamage || isVoided) && (
          <motion.div 
              initial={{ opacity: 0, scale: 3, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className={clsx(
                  "absolute inset-0 w-full h-full flex justify-center items-center z-30 pointer-events-none",
              )}
          >
              {/* CAMBIO: Aumentado tamaño a w-16 h-16 (aprox 25%+ grande) */}
              <div className={clsx(
                  "w-16 h-16 rounded-full border-[3px] border-black flex items-center justify-center shadow-[4px_4px_0_rgba(0,0,0,0.5)]",
                  card.damageSource.owner === 'player' ? "bg-[#0066FF]" : "bg-[#FF2222]"
              )}>
                  {/* CAMBIO: Aumentado tamaño de texto a text-3xl */}
                  <span className={clsx(
                      "text-3xl font-black text-white"
                  )}>
                      {card.damageSource.rank}
                  </span>
              </div>
          </motion.div>
      )}

    </motion.div>
  );
};