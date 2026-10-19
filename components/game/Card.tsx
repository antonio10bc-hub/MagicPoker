import { memo, ReactNode } from 'react';
import { Card as CardType, Owner } from '@/types';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { RANKS } from '@/lib/game-utils';
import { JOKER_DRAW_BONUS } from '@/lib/constants';
import { CARD_SIZE, TEAM } from '@/theme/tokens';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { CHARACTERS, EMBLEM_OPPONENT, EMBLEM_PLAYER, PIP, STAR } from '@/components/pixel/sprites';
import { CARD_BACK_TILE, WINDOW_TILE, patternUri } from '@/components/pixel/patterns';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  isSelected?: boolean;
  /** Carta en mano que ahora no se puede jugar (se desatura) */
  isDisabled?: boolean;
  className?: string;
}

export const EMBLEMS: Record<Owner, typeof EMBLEM_PLAYER> = { player: EMBLEM_PLAYER, opponent: EMBLEM_OPPONENT };

// --- PIPS DE CARTAS NUMÉRICAS (posición en una rejilla de 3 columnas × 5 filas) ---
const PIP_LAYOUT: Record<number, [number, number][]> = {
  2: [[1, 0], [1, 4]],
  3: [[1, 0], [1, 2], [1, 4]],
  4: [[0, 0], [2, 0], [0, 4], [2, 4]],
  5: [[0, 0], [2, 0], [1, 2], [0, 4], [2, 4]],
  6: [[0, 0], [2, 0], [0, 2], [2, 2], [0, 4], [2, 4]],
  7: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2], [0, 4], [2, 4]],
  8: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2], [1, 3], [0, 4], [2, 4]],
  9: [[0, 0], [2, 0], [0, 4 / 3], [2, 4 / 3], [1, 2], [0, 8 / 3], [2, 8 / 3], [0, 4], [2, 4]],
  10: [[0, 0], [2, 0], [1, 2 / 3], [0, 4 / 3], [2, 4 / 3], [0, 8 / 3], [2, 8 / 3], [1, 10 / 3], [0, 4], [2, 4]],
};
const PIP_COLS = [6, 14, 23];
const pipRow = (r: number) => Math.floor(1 + r * 5.25);

const Pips = ({ value, owner }: { value: number; owner: Owner }) => (
  <>
    {(PIP_LAYOUT[value] ?? []).map(([c, r], i) => (
      <PixelSprite key={i} sprite={PIP} owner={owner} style={{ position: 'absolute', left: PIP_COLS[c], top: pipRow(r) }} />
    ))}
  </>
);

// --- INSIGNIA DE ATAQUE: 3 casillas (izquierda, frente, derecha) ---
const AttackBadge = ({ card }: { card: CardType }) => {
  const def = RANKS[card.rank];
  let content: ReactNode;
  if (def.wipesBoard) {
    content = <PixelSprite sprite={STAR} />;
  } else if (!def.attack) {
    content = <span className="text-outline leading-[10px]">+{JOKER_DRAW_BONUS}</span>;
  } else {
    const fill = def.attack.mode === 'random-one' ? 'var(--c-cyan)' : 'var(--c-yellow)';
    // El rival ataca hacia abajo: su izquierda es nuestra derecha en pantalla, pero
    // el patrón es simétrico, así que basta con marcar las casillas.
    content = [-1, 0, 1].map(offset => (
      <span key={offset} style={{
        width: 3, height: 4,
        background: def.attack!.offsets.includes(offset) ? fill : 'var(--c-stone-dark)',
        boxShadow: '0 0 0 1px var(--c-outline)',
      }} />
    ));
  }
  return (
    <div className="px-round absolute flex items-center justify-center gap-[2px]"
      style={{ left: 22, top: 44, width: 15, height: 10, background: 'var(--c-navy)', boxShadow: 'inset 0 0 0 1px var(--c-outline)' }}>
      {content}
    </div>
  );
};

const ValueBadge = ({ value }: { value: number }) => (
  <div className="px-round absolute flex items-center justify-center"
    style={{ left: 3, top: 44, width: 17, height: 10, background: 'var(--c-yellow)', boxShadow: 'inset 0 0 0 1px var(--c-outline), inset 1px 1px 0 1px #FFF0A0' }}>
    <span className="leading-[10px] pt-[1px]" style={{ color: 'var(--c-outline)' }}>{value}</span>
  </div>
);

// --- DORSO ---
const CardBack = ({ owner }: { owner: Owner }) => (
  <div className="px-round-2 absolute inset-0" style={{ background: 'var(--c-outline)' }}>
    <div className="absolute" style={{ inset: 1, background: 'var(--c-white)', boxShadow: 'inset -1px -1px 0 0 var(--c-floor)' }} />
    <div className="absolute" style={{
      inset: 3, backgroundImage: patternUri('card-back', CARD_BACK_TILE, owner), backgroundSize: '8px',
      boxShadow: 'inset 0 0 0 1px var(--c-outline)',
    }} />
    {/* Placa central con el emblema */}
    <div className="absolute flex items-center justify-center" style={{
      left: 12, top: 20, width: 16, height: 16, background: 'var(--c-white)',
      boxShadow: 'inset 0 0 0 1px var(--c-outline), inset -1px -1px 0 1px var(--c-floor)',
    }}>
      <PixelSprite sprite={EMBLEMS[owner]} owner={owner} />
    </div>
  </div>
);

// --- ANVERSO ---
const CardFace = ({ card }: { card: CardType }) => {
  const team = TEAM[card.owner];
  const character = CHARACTERS[card.rank];
  return (
    <div className="px-round-2 absolute inset-0" style={{ background: 'var(--c-outline)' }}>
      {/* Marco con bisel */}
      <div className="absolute" style={{ inset: 1, background: 'var(--c-white)', boxShadow: 'inset 1px 1px 0 0 #ffffff, inset -1px -1px 0 0 var(--c-floor)' }} />
      {/* Banda de nombre */}
      <div className="absolute text-outline whitespace-nowrap" style={{
        left: 2, top: 2, width: 36, height: 12, padding: '2px 0 0 3px', background: team.base,
        boxShadow: `inset 0 0 0 1px var(--c-outline), inset 1px 1px 0 1px ${team.light}`,
      }}>
        {card.rank}
      </div>
      {/* Ventana de ilustración */}
      <div className="absolute overflow-hidden" style={{
        left: 3, top: 15, width: 34, height: 28, backgroundImage: patternUri('window', WINDOW_TILE), backgroundSize: '4px',
        boxShadow: 'inset 0 0 0 1px var(--c-outline)',
      }}>
        {character
          ? <PixelSprite sprite={character} owner={card.owner} style={{ position: 'absolute', left: 9, top: 4 }} />
          : <Pips value={card.value} owner={card.owner} />}
      </div>
      <ValueBadge value={card.value} />
      <AttackBadge card={card} />
    </div>
  );
};

/** Sello del atacante sobre la carta destruida (K/Q/J o el As) */
const DamageStamp = ({ source }: { source: NonNullable<CardType['damageSource']> }) => (
  <motion.div
    initial={{ scale: 3, opacity: 0, rotate: -30 }}
    animate={{ scale: 1, opacity: 1, rotate: 0 }}
    transition={{ type: 'spring', stiffness: 500, damping: 14, delay: IMPACT_DELAY_S + 0.08 }}
    className="absolute z-30 flex items-center justify-center text-outline"
    style={{
      left: 10, top: 18, width: 20, height: 20, borderRadius: '50%', background: TEAM[source.owner].base,
      boxShadow: `inset 0 0 0 1px var(--c-outline), inset 1px 1px 0 1px ${TEAM[source.owner].light}`,
    }}
  >
    {source.rank}
  </motion.div>
);

/** Retraso del daño: primero llega la embestida del atacante, luego el golpe */
export const IMPACT_DELAY_S = 0.22;

const faceStyle = { backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' } as const;

const CardComponent = ({ card, onClick, isSelected, isDisabled, className }: CardProps) => {
  const isDamage = !!card.isTakingDamage;
  const isVoided = !!card.isVoided;

  return (
    <motion.div
      onClick={onClick}
      animate={
        isDamage ? { x: [0, -2, 2, -2, 1, 0], rotate: [0, -3, 3, -2, 0] } :
        isVoided ? { scale: [1, 1.08, 0.9], rotate: [0, -4, 6] } :
        { x: 0, scale: 1, rotate: 0 }
      }
      transition={{ duration: 0.35, delay: isDamage || isVoided ? IMPACT_DELAY_S : 0, ease: 'easeOut' }}
      className={clsx('relative', onClick && 'cursor-pointer', isSelected && 'card-glow', className)}
      style={{
        width: CARD_SIZE.width,
        height: CARD_SIZE.height,
        perspective: 220,
        filter: isVoided ? 'grayscale(1) brightness(0.7)' : isDisabled ? 'saturate(0.45) brightness(0.92)' : undefined,
        transition: 'filter 0.3s ease',
      }}
    >
      {/* Volteo real en 3D: anverso y dorso son las dos caras de un mismo plano */}
      <motion.div
        className="absolute inset-0"
        style={{ transformStyle: 'preserve-3d' }}
        initial={false}
        animate={{ rotateY: card.isFaceUp ? 0 : 180 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div className="absolute inset-0" style={faceStyle}><CardFace card={card} /></div>
        <div className="absolute inset-0" style={{ ...faceStyle, transform: 'rotateY(180deg)' }}><CardBack owner={card.owner} /></div>
      </motion.div>

      {/* Golpe: destello blanco y velo rojo que late */}
      {isDamage && (
        <>
          <motion.div className="px-round-2 absolute inset-0 pointer-events-none" style={{ background: 'var(--c-white)' }}
            initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.25, delay: IMPACT_DELAY_S }} />
          <motion.div className="px-round-2 absolute inset-0 pointer-events-none" style={{ background: 'rgba(192,40,28,0.5)', boxShadow: 'inset 0 0 0 1px var(--c-red)' }}
            initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.55, 1] }} transition={{ duration: 0.9, delay: IMPACT_DELAY_S + 0.1, repeat: Infinity, repeatType: 'reverse' }} />
          <Cracks />
        </>
      )}
      {isVoided && (
        <motion.div className="px-round-2 absolute inset-0 pointer-events-none" style={{ background: 'rgba(46,58,92,0.55)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: IMPACT_DELAY_S }} />
      )}
      {card.damageSource && (isDamage || isVoided) && <DamageStamp source={card.damageSource} />}
    </motion.div>
  );
};

/** Grietas que se dibujan sobre la carta destruida */
const Cracks = () => (
  <motion.svg
    className="absolute inset-0 pointer-events-none" width={CARD_SIZE.width} height={CARD_SIZE.height}
    viewBox={`0 0 ${CARD_SIZE.width} ${CARD_SIZE.height}`} shapeRendering="crispEdges"
  >
    <motion.path
      d="M20 0 L17 12 L23 20 L15 31 L22 40 L18 56 M23 20 L33 24 M15 31 L6 34"
      fill="none" stroke="var(--c-outline)" strokeWidth={1.5}
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.2, delay: IMPACT_DELAY_S + 0.05 }}
    />
  </motion.svg>
);

// memo: las cartas solo se re-renderizan si cambian sus props
export const Card = memo(CardComponent);
