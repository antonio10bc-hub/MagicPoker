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

  // --- CHIVATO EN CONSOLA ---
  // Abre la consola (F12) para ver esto
  console.log(`🃏 Render Carta [${card.rank}] (ID: ${card.id.substring(0,4)})`, {
    owner: card.owner,
    isOpponent: isOpponent,
    shouldBeRed: isOpponent,
    shouldBeBlue: !isOpponent
  });

  // --- ESTILOS BASE DOODLE ---
  // NOTA: He quitado 'bg-white' de aquí para que no pelee con el color inline
  const baseCardStyle = "relative w-full h-full aspect-[2/3] rounded-md border-[4px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-between p-1 cursor-pointer select-none transition-all overflow-hidden bg-white";
  
  // Determinamos el color Hexadecimal exacto
  let debugBgColor = isOpponent ? '#FF2222' : '#0066FF'; // Rojo vs Azul Eléctrico
  let textColorClass = "text-white";

  // Estados especiales
  if (isVoided) {
      debugBgColor = '#000000'; // Negro
  } else if (isDamage) {
      debugBgColor = '#FF2222'; // Rojo daño
  } else if (isJoker && !isDamage && !isVoided) {
      debugBgColor = '#FDE047'; // Amarillo (yellow-300 aprox)
      textColorClass = "text-black";
  }

  // Animaciones y bordes extra
  let animationStyles = {};
  if (isDamage) animationStyles = { animate: "wiggle" }; // Nota: esto requiere config en tailwind, si no va, usaremos framer
  
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
          "pattern-diagonal-lines-sm text-black/20 justify-center !p-0", 
          className
        )}
        // FUERZA BRUTA: Aplicamos el color directo al estilo
        style={{ backgroundColor: isOpponent ? '#FF2222' : '#0066FF' }}
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
        textColorClass,
        selectionStyle,
        // Eliminamos las clases de bg-[...] de aquí porque usaremos style
        isVoided && "pattern-diagonal-lines-sm",
        isJoker && !isDamage && !isVoided && "pattern-zigzag-sm",
        isDamage && "animate-[wiggle_0.2s_ease-in-out_infinite]",
        className
      )}
      // FUERZA BRUTA: El color se aplica aquí sí o sí
      style={{ backgroundColor: debugBgColor }}
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
              <div className={clsx(
                  "w-16 h-16 rounded-full border-[3px] border-black flex items-center justify-center shadow-[4px_4px_0_rgba(0,0,0,0.5)]",
              )}
              // Color del círculo también forzado por estilo
              style={{ backgroundColor: card.damageSource.owner === 'player' ? "#0066FF" : "#FF2222" }}
              >
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