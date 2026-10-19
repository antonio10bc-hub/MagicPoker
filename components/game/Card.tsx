import { memo } from 'react';
import { Card as CardType } from '@/types';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { ArrowUp, ArrowUpLeft, ArrowUpRight, ArrowDown, ArrowDownLeft, ArrowDownRight, LucideIcon } from 'lucide-react';
import { RANKS } from '@/lib/game-utils';
import { COLORS, OWNER_COLORS } from '@/lib/constants';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  isSelected?: boolean;
  className?: string;
  isInHand?: boolean;
}

// Flecha por desplazamiento de ataque (-1 izquierda, 0 frente, +1 derecha)
const ARROWS: Record<'player' | 'opponent', Record<number, LucideIcon>> = {
  player: { [-1]: ArrowUpLeft, 0: ArrowUp, 1: ArrowUpRight },
  opponent: { [-1]: ArrowDownLeft, 0: ArrowDown, 1: ArrowDownRight },
};

const baseCardStyle = "relative w-full h-full aspect-[2/3] rounded-md border-[2px] sm:border-[3px] border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-between p-0.5 sm:p-1 cursor-pointer select-none transition-all overflow-hidden bg-white";

const AttackIndicators = ({ card, isInHand }: { card: CardType; isInHand?: boolean }) => {
  const pattern = RANKS[card.rank].attack;
  if (!pattern || card.isVoided) return null;

  const isOpponent = card.owner === 'opponent';
  // Iconos un poco más pequeños si está en la mano para no saturar
  const iconClass = clsx(
    isInHand ? "w-3 h-3 sm:w-4 sm:h-4 stroke-[2px]" : "w-3 h-3 sm:w-5 sm:h-5 stroke-[3px] sm:stroke-[4px]",
    "text-white drop-shadow-[0_1px_0_#000] sm:drop-shadow-[0_2px_0_#000]"
  );

  return (
    <div className={clsx(
      "absolute left-0 w-full flex justify-center gap-0.5 pointer-events-none z-20",
      isOpponent ? "bottom-0.5 sm:bottom-1" : "top-0.5 sm:top-1"
    )}>
      {pattern.offsets.map(offset => {
        const Icon = ARROWS[card.owner][offset];
        return <Icon key={offset} className={iconClass} />;
      })}
    </div>
  );
};

const CardComponent = ({ card, onClick, isSelected, className, isInHand }: CardProps) => {
  const isJoker = card.rank === 'JOKER';
  const isDamage = card.isTakingDamage;
  const isVoided = card.isVoided;
  const isOpponent = card.owner === 'opponent';

  // --- REVERSO (BACK) ---
  if (!card.isFaceUp) {
    return (
      <motion.div
        layoutId={card.id}
        className={clsx(baseCardStyle, "pattern-diagonal-lines-sm text-black/20 justify-center items-center !p-0", className)}
        style={{ backgroundColor: isOpponent ? COLORS.opponentCardBack : COLORS.player }}
      >
        {/* Si está en mano, pequeño. Si no, gigante */}
        <div className={clsx(
          "font-black text-white drop-shadow-[1px_2px_0_#000] leading-none",
          isInHand ? "text-3xl sm:text-4xl" : "text-7xl sm:text-6xl"
        )}>?</div>
      </motion.div>
    );
  }

  // --- ANVERSO (FRONT) ---
  const bgColor = isVoided ? COLORS.voided : isDamage ? COLORS.damage : isJoker ? COLORS.joker : OWNER_COLORS[card.owner];
  const isPlainJoker = isJoker && !isDamage && !isVoided;

  const selectionStyle = isSelected
    ? "border-yellow-400 shadow-[4px_4px_0_#000] sm:shadow-[8px_8px_0_#000] -translate-y-1 sm:-translate-y-2 -translate-x-0.5 sm:-translate-x-1"
    : "hover:-translate-y-1 hover:shadow-[3px_3px_0_#000] sm:shadow-[6px_6px_0_#000]";

  // JOKER: mano -> text-lg, mesa -> text-4xl. NÚMERO: mano -> text-3xl, mesa -> text-7xl
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
        isPlainJoker ? "text-black" : "text-white",
        selectionStyle,
        isVoided && "pattern-diagonal-lines-sm",
        isPlainJoker && "pattern-zigzag-sm",
        isDamage && "animate-[wiggle_0.2s_ease-in-out_infinite]",
        className
      )}
      style={{ backgroundColor: bgColor }}
    >
      <AttackIndicators card={card} isInHand={isInHand} />

      <div className={clsx(
        "font-black flex items-center justify-center h-full z-10 drop-shadow-[1px_1px_0_#000] sm:drop-shadow-[2px_2px_0_#000]",
        isJoker && "-rotate-90 tracking-widest",
        fontSizeClass
      )}>
        {card.rank}
      </div>

      {card.damageSource && (isDamage || isVoided) && (
        <motion.div
          initial={{ opacity: 0, scale: 3, rotate: -20 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          className="absolute inset-0 w-full h-full flex justify-center items-center z-30 pointer-events-none"
        >
          <div
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-[2px] sm:border-[3px] border-black flex items-center justify-center shadow-[1px_1px_0_rgba(0,0,0,0.5)] sm:shadow-[2px_2px_0_rgba(0,0,0,0.5)]"
            style={{ backgroundColor: OWNER_COLORS[card.damageSource.owner] }}
          >
            <span className="text-2xl sm:text-3xl font-black text-white">{card.damageSource.rank}</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

// memo: las cartas solo se re-renderizan si cambian sus props
export const Card = memo(CardComponent);
