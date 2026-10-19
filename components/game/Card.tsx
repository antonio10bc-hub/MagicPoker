import { memo, ReactNode } from 'react';
import { Card as CardType, Owner } from '@/types';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { RANKS } from '@/lib/game-utils';
import { JOKER_DRAW_BONUS } from '@/lib/constants';
import { CARD_SIZE, INK, TEAM } from '@/theme/tokens';
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
const pipRow = (r: number) => Math.floor(3 + r * 7.5);

const Pips = ({ value }: { value: number }) => (
  <div style={{ opacity: 0.3 }}>
    {(PIP_LAYOUT[value] ?? []).map(([c, r], i) => (
      <PixelSprite key={i} sprite={PIP} tint={INK.black} style={{ position: 'absolute', left: PIP_COLS[c], top: pipRow(r) }} />
    ))}
  </div>
);

// --- INSIGNIA DE ATAQUE: 3 casillas (izquierda, frente, derecha) ---
const AttackBadge = ({ card }: { card: CardType }) => {
  const def = RANKS[card.rank];
  let content: ReactNode;
  if (def.wipesBoard) {
    content = <PixelSprite sprite={STAR} tint={INK.cream} />;
  } else if (!def.attack) {
    content = <span className="text-outline font-display leading-[10px] pt-[1px]">+{JOKER_DRAW_BONUS}</span>;
  } else {
    // Golpe seguro: brasa; al azar (J): menta
    const fill = def.attack.mode === 'random-one' ? 'var(--ink-mint)' : 'var(--ink-ember)';
    // El rival ataca hacia abajo: su izquierda es nuestra derecha en pantalla, pero
    // el patrón es simétrico, así que basta con marcar las casillas.
    content = [-1, 0, 1].map(offset => {
      const on = def.attack!.offsets.includes(offset);
      return (
        <span key={offset} style={{
          width: 3, height: 4, borderRadius: 1,
          background: on ? fill : 'var(--ink-slate)',
          boxShadow: on ? `0 0 2px ${fill}` : undefined,
        }} />
      );
    });
  }
  return (
    <div className="px-round absolute flex items-center justify-center gap-[2px]"
      style={{ left: 22, top: 44, width: 15, height: 10, background: 'rgba(11,13,12,0.85)' }}>
      {content}
    </div>
  );
};

/** Insignia de valor: píldora negra con la cifra crema (máximo contraste) */
const ValueBadge = ({ value }: { value: number }) => (
  <div className="absolute flex items-center justify-center font-display text-outline"
    style={{ left: 3, top: 44, width: 17, height: 10, borderRadius: 2, background: 'rgba(11,13,12,0.85)', fontSize: 11 }}>
    <span className="leading-[10px] pt-[2px]">{value}</span>
  </div>
);

/** Cuerpo y ventana de cada bando: el jugador es pizarra con niebla crema detrás;
 *  el rival, una masa naranja con el núcleo encendido. */
const LOOK: Record<Owner, { body: string; window: string; glow: string }> = {
  player: {
    body: 'var(--ink-slate)',
    window: `linear-gradient(to bottom, rgba(30,42,40,0.65) 0%, rgba(30,42,40,0) 55%), ${patternUri('window', WINDOW_TILE)}`,
    glow: '',
  },
  opponent: {
    body: 'var(--ink-orange)',
    window: `radial-gradient(ellipse 60% 55% at 50% 60%, rgba(237,235,224,0.55) 0%, rgba(242,101,42,0) 70%), ${patternUri('card-back', CARD_BACK_TILE, 'opponent')}`,
    glow: 'bloom',
  },
};

// --- DORSO ---
// Sin dibujo: una masa de grano del color del bando cuyos bordes se deshacen
const CardBack = ({ owner }: { owner: Owner }) => (
  <div className={clsx('px-round-2 absolute inset-0', owner === 'opponent' && 'bloom')} style={{ background: owner === 'opponent' ? 'rgba(255,74,28,0.35)' : 'var(--ink-slate)' }}>
    <div className="absolute inset-0" style={{
      backgroundImage: `radial-gradient(ellipse 55% 50% at 50% 50%, ${owner === 'opponent' ? 'rgba(237,235,224,0.45)' : 'rgba(94,122,118,0.35)'} 0%, transparent 70%), ${patternUri('card-back', CARD_BACK_TILE, owner)}`,
      backgroundSize: '100% 100%, 16px',
      WebkitMaskImage: 'radial-gradient(ellipse 75% 70% at 50% 50%, #000 55%, transparent 100%)',
      maskImage: 'radial-gradient(ellipse 75% 70% at 50% 50%, #000 55%, transparent 100%)',
      filter: 'blur(0.6px)',
    }} />
    {/* Emblema del bando en silueta */}
    <div className="absolute flex items-center justify-center" style={{ left: 12, top: 20, width: 16, height: 16 }}>
      <PixelSprite sprite={EMBLEMS[owner]} tint={INK.black} />
    </div>
  </div>
);

// --- ANVERSO ---
const CardFace = ({ card }: { card: CardType }) => {
  const look = LOOK[card.owner];
  const character = CHARACTERS[card.rank];
  return (
    <div className={clsx('px-round-2 absolute inset-0', look.glow)} style={{ background: look.body, boxShadow: card.owner === 'player' ? '0 0 6px 1px rgba(237,235,224,0.14)' : undefined }}>
      {/* Ventana de ilustración (ocupa casi toda la carta) */}
      <div className="absolute overflow-hidden" style={{
        left: 3, top: 3, width: 34, height: 39, borderRadius: 2,
        backgroundImage: look.window, backgroundSize: card.owner === 'opponent' ? '100% 100%, 16px' : '100% 100%, 8px',
      }}>
        {character ? (
          // Personaje: silueta casi negra, lectura por contorno
          <PixelSprite sprite={character} tint={INK.black} style={{ position: 'absolute', left: 14, bottom: 1 }} />
        ) : (
          <>
            <Pips value={card.value} />
            {/* Número grande en el centro: silueta oscura sobre la luz */}
            <div className="absolute inset-0 flex items-center justify-center font-display"
              style={{ fontSize: 34, lineHeight: '30px', paddingTop: 5, color: 'var(--ink-black)', textShadow: '0.6px 0 0 rgba(255,74,28,0.35)' }}>
              {card.rank}
            </div>
          </>
        )}
      </div>
      {/* Rango de las figuras (esquina superior izquierda) */}
      {character && (
        <div className="absolute font-display flex items-center justify-center"
          style={{
            left: 3, top: 3, height: card.rank === 'JOKER' ? 11 : 17, padding: '0 3px',
            fontSize: card.rank === 'JOKER' ? 11 : 20, lineHeight: card.rank === 'JOKER' ? '11px' : '17px',
            paddingTop: card.rank === 'JOKER' ? 2 : 3,
            color: 'var(--ink-black)', borderRadius: '2px 0 3px 0',
          }}>
          {card.rank}
        </div>
      )}
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
    className={clsx('absolute z-30 flex items-center justify-center font-display', source.owner === 'opponent' ? 'text-ink bloom' : 'text-outline')}
    style={{
      left: 10, top: 18, width: 20, height: 20, borderRadius: '50%', background: TEAM[source.owner].base, fontSize: 14, paddingTop: 2,
    }}
  >
    {source.rank}
  </motion.div>
);

/**
 * Coreografía visual del choque (no afecta a la lógica, que ya está resuelta):
 * las flechas de ataque se ven un momento (ARROW_HOLD_S), luego las cartas embisten
 * y el golpe llega IMPACT_DELAY_S después de publicarse el resultado.
 */
export const ARROW_HOLD_S = 0.6;
export const IMPACT_DELAY_S = ARROW_HOLD_S + 0.22;

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
        filter: isVoided ? 'grayscale(1) brightness(0.55)' : isDisabled ? 'saturate(0.4) brightness(0.6)' : undefined,
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
          <motion.div className="px-round-2 absolute inset-0 pointer-events-none" style={{ background: 'rgba(255,74,28,0.5)', filter: 'blur(0.6px)', boxShadow: '0 0 8px 2px rgba(255,74,28,0.6)' }}
            initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.55, 1] }} transition={{ duration: 0.9, delay: IMPACT_DELAY_S + 0.1, repeat: Infinity, repeatType: 'reverse' }} />
          <Cracks />
        </>
      )}
      {isVoided && (
        <motion.div className="px-round-2 absolute inset-0 pointer-events-none" style={{ background: 'rgba(11,13,12,0.6)' }}
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
      fill="none" stroke="#0B0D0C" strokeWidth={1.5}
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.2, delay: IMPACT_DELAY_S + 0.05 }}
    />
  </motion.svg>
);

// memo: las cartas solo se re-renderizan si cambian sus props
export const Card = memo(CardComponent);
