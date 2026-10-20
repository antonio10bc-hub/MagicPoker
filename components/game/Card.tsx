import { memo, ReactNode, useEffect, useState } from 'react';
import { Card as CardType, Owner } from '@/types';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { RANKS } from '@/lib/game-utils';
import { gameTimeout } from '@/lib/clock';
import { JOKER_DRAW_BONUS } from '@/lib/constants';
import { CARD_SIZE, INK, TEAM } from '@/theme/tokens';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { CHARACTERS, EMBLEM_OPPONENT, EMBLEM_PLAYER, PIP, SEAL_ICONS, STAR } from '@/components/pixel/sprites';
import { useTranslations, Translations } from '@/lib/i18n';
import { SealId } from '@/types';
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

/** Insignia de valor: píldora negra con la cifra crema (máximo contraste). Expuesta
 *  (sello de revelar): la cifra baja en uno y la píldora se enciende en brasa. */
const ValueBadge = ({ value, exposed }: { value: number; exposed?: boolean }) => (
  <div className={clsx('absolute flex items-center justify-center font-display', exposed ? 'text-ink' : 'text-outline')}
    style={{ left: 3, top: 44, width: 17, height: 10, borderRadius: 2, background: exposed ? 'var(--ink-ember)' : 'rgba(11,13,12,0.85)', fontSize: 11 }}>
    <span className="leading-[10px] pt-[2px]">{exposed ? value - 1 : value}</span>
  </div>
);

/** Ojo sobre una carta expuesta por un sello de revelar */
const ExposedEye = () => (
  <div className="absolute z-20 flex items-center justify-center rounded-full anim-throb pointer-events-none"
    style={{ left: -4, top: -4, width: 13, height: 13, background: 'var(--ink-ember)', boxShadow: '0 0 6px rgba(242,101,42,0.8)' }}>
    <PixelSprite sprite={SEAL_ICONS.reveal} tint={INK.black} />
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

/** Carta con sello: toda ella se tiñe de verde voltio (cuerpo, ventana y dorso) */
const VOLT_WASH = 'linear-gradient(rgba(125,255,43,0.6), rgba(125,255,43,0.6))';
const SEALED_LOOK = {
  body: 'radial-gradient(ellipse 80% 70% at 50% 45%, #B6FF7A 0%, var(--ink-volt) 55%, #4FC414 100%)',
  window: (owner: Owner) => `radial-gradient(ellipse 60% 55% at 50% 60%, rgba(237,255,214,0.6) 0%, rgba(125,255,43,0) 70%), ${VOLT_WASH}, ${
    owner === 'opponent' ? patternUri('card-back', CARD_BACK_TILE, 'opponent') : patternUri('window', WINDOW_TILE)}`,
};

// --- DORSO ---
// Sin dibujo: una masa de grano del color del bando cuyos bordes se deshacen
const CardBack = ({ owner, sealed }: { owner: Owner; sealed?: boolean }) => (
  <div className={clsx('px-round-2 absolute inset-0', sealed ? 'bloom-volt' : owner === 'opponent' && 'bloom')}
    style={{ background: sealed ? 'var(--ink-volt-dark)' : owner === 'opponent' ? 'rgba(255,74,28,0.35)' : 'var(--ink-slate)' }}>
    <div className="absolute inset-0" style={{
      backgroundImage: sealed
        ? `radial-gradient(ellipse 55% 50% at 50% 50%, rgba(216,255,154,0.6) 0%, transparent 70%), ${VOLT_WASH}, ${patternUri('card-back', CARD_BACK_TILE, owner)}`
        : `radial-gradient(ellipse 55% 50% at 50% 50%, ${owner === 'opponent' ? 'rgba(237,235,224,0.45)' : 'rgba(94,122,118,0.35)'} 0%, transparent 70%), ${patternUri('card-back', CARD_BACK_TILE, owner)}`,
      backgroundSize: sealed ? '100% 100%, 100% 100%, 16px' : '100% 100%, 16px',
      WebkitMaskImage: 'radial-gradient(ellipse 75% 70% at 50% 50%, #000 55%, transparent 100%)',
      maskImage: 'radial-gradient(ellipse 75% 70% at 50% 50%, #000 55%, transparent 100%)',
    }} />
    {/* Emblema del bando en silueta */}
    <div className="absolute flex items-center justify-center" style={{ left: 12, top: 20, width: 16, height: 16 }}>
      <PixelSprite sprite={EMBLEMS[owner]} tint={INK.black} />
    </div>
  </div>
);

// --- ANVERSO ---
const CardFace = ({ card, sealed }: { card: CardType; sealed: boolean }) => {
  if (card.rank === 'SEAL' && card.seal) return <SealCardFace seal={card.seal} />;
  const look = LOOK[card.owner];
  const character = CHARACTERS[card.rank];
  const tile = card.owner === 'opponent' ? '16px' : '8px';
  return (
    <div className={clsx('px-round-2 absolute inset-0', sealed ? 'bloom-volt' : look.glow)}
      style={{ background: sealed ? SEALED_LOOK.body : look.body, boxShadow: !sealed && card.owner === 'player' ? '0 0 6px 1px rgba(237,235,224,0.14)' : undefined }}>
      {/* Ventana de ilustración (ocupa casi toda la carta) */}
      <div className="absolute overflow-hidden" style={{
        left: 3, top: 3, width: 34, height: 39, borderRadius: 2,
        backgroundImage: sealed ? SEALED_LOOK.window(card.owner) : look.window,
        backgroundSize: sealed ? `100% 100%, 100% 100%, ${tile}` : `100% 100%, ${tile}`,
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
      <ValueBadge value={card.value} exposed={card.isExposed} />
      <AttackBadge card={card} />
    </div>
  );
};

// --- SELLOS (verde eléctrico) ---
export const sealTag = (t: Translations, seal: SealId) => t[`seal_tag_${seal}` as keyof Translations];

/** Carta de sello: masa verde que brilla, con el icono en silueta y su nombre */
const SealCardFace = ({ seal }: { seal: SealId }) => {
  const t = useTranslations();
  return (
    <div className="px-round-2 absolute inset-0 bloom-volt" style={{
      background: 'radial-gradient(ellipse 70% 60% at 50% 42%, #D8FF9A 0%, var(--ink-volt) 45%, #4FC414 100%)',
    }}>
      <div className="absolute flex items-center justify-center" style={{ left: 3, top: 6, width: 34, height: 30 }}>
        <PixelSprite sprite={SEAL_ICONS[seal]} tint={INK.black} scale={2} />
      </div>
      <div className="absolute left-0 right-0 flex justify-center font-display" style={{ top: 40, fontSize: 9, lineHeight: '9px', color: 'var(--ink-black)' }}>
        {sealTag(t, seal)}
      </div>
      <div className="absolute flex items-center justify-center rounded-full" style={{ left: 15, top: 2, width: 10, height: 3, background: 'rgba(11,13,12,0.35)' }} />
    </div>
  );
};

/** Sello puesto sobre una carta de la mesa: insignia verde en la esquina superior derecha */
export const SealBadge = ({ seal, pulse }: { seal: SealId; pulse?: boolean }) => (
  <div className={clsx('absolute z-20 flex items-center justify-center rounded-full bloom-volt pointer-events-none', pulse && 'anim-throb')}
    style={{ right: -4, top: -4, width: 13, height: 13, background: 'var(--ink-volt)' }}>
    <PixelSprite sprite={SEAL_ICONS[seal]} tint={INK.black} />
  </div>
);

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
/** Doble embestida (sello de ataque): el segundo golpe llega SECOND_HIT_S después del primero */
export const DOUBLE_LUNGE_S = 0.62;
export const SECOND_HIT_S = DOUBLE_LUNGE_S * (0.75 - 0.36);

const faceStyle = { backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' } as const;

/** Momento en que el escudo, tras parar los golpes, se rompe */
export const SHIELD_BREAK_S = IMPACT_DELAY_S + 0.65;

const CardComponent = ({ card, onClick, isSelected, isDisabled, className }: CardProps) => {
  const isDamage = !!card.isTakingDamage;
  const isVoided = !!card.isVoided;
  // El escudo (o el espejo) ha parado el golpe: al romperse la carta pierde el verde
  const spent = !!card.isShielded || !!card.isReflecting;
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    if (!spent) return;
    const cancel = gameTimeout(() => setBroken(true), SHIELD_BREAK_S * 1000);
    return () => { cancel(); setBroken(false); };
  }, [spent]);
  const sealed = !!card.seal && card.rank !== 'SEAL' && !(spent && broken);

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
        <div className="absolute inset-0" style={faceStyle}><CardFace card={card} sealed={sealed} /></div>
        <div className="absolute inset-0" style={{ ...faceStyle, transform: 'rotateY(180deg)' }}><CardBack owner={card.owner} sealed={sealed} /></div>
      </motion.div>

      {/* Golpe: destello blanco y velo rojo que late */}
      {isDamage && (
        <>
          <motion.div className="px-round-2 absolute inset-0 pointer-events-none" style={{ background: 'var(--c-white)' }}
            initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.25, delay: IMPACT_DELAY_S }} />
          <motion.div className="px-round-2 absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: IMPACT_DELAY_S + 0.1 }}>
            <div className="absolute inset-0 anim-pulse" style={{ background: 'rgba(255,74,28,0.5)', boxShadow: '0 0 8px 2px rgba(255,74,28,0.6)', animationDuration: '0.9s' }} />
          </motion.div>
          <Cracks />
        </>
      )}
      {isVoided && (
        <motion.div className="px-round-2 absolute inset-0 pointer-events-none" style={{ background: 'rgba(11,13,12,0.6)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: IMPACT_DELAY_S }} />
      )}
      {/* Sello puesto (se ve aunque la carta esté boca abajo) */}
      {sealed && <SealBadge seal={card.seal!} />}
      {card.isExposed && card.isFaceUp && <ExposedEye />}
      {/* Espejo: un destello cruza la carta al devolver el golpe */}
      {card.isReflecting && <MirrorSheen />}
      {/* Sello de defensa: una burbuja verde se levanta, encaja los golpes temblando y estalla */}
      {card.isShielded && <ShieldBubble />}
      {card.damageSource && (isDamage || isVoided) && <DamageStamp source={card.damageSource} />}
    </motion.div>
  );
};

/** Destello del espejo: una franja de luz cruza la carta en el momento del golpe */
const MirrorSheen = () => (
  <div className="px-round-2 absolute inset-0 overflow-hidden pointer-events-none z-30">
    <motion.div className="absolute" style={{ top: -10, bottom: -10, width: 14, background: 'linear-gradient(90deg, transparent, rgba(237,255,214,0.95), rgba(125,255,43,0.8), transparent)', rotate: 20 }}
      initial={{ x: -24 }} animate={{ x: [-24, 50, 50] }} transition={{ duration: 0.5, delay: IMPACT_DELAY_S - 0.1, times: [0, 0.7, 1] }} />
    <motion.div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 0 2px var(--ink-volt), 0 0 14px 4px rgba(125,255,43,0.7)' }}
      initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.6, delay: IMPACT_DELAY_S }} />
  </div>
);

/** Burbuja del escudo: aparece con las flechas, encaja el golpe y se rompe */
const ShieldBubble = () => (
  <motion.div className="absolute pointer-events-none z-30"
    style={{ left: -6, top: -6, right: -6, bottom: -6, borderRadius: '50% / 45%',
      background: 'radial-gradient(ellipse at 50% 45%, rgba(125,255,43,0.05) 40%, rgba(125,255,43,0.35) 85%)',
      boxShadow: '0 0 0 1.5px var(--ink-volt), 0 0 12px 4px rgba(125,255,43,0.55)' }}
    initial={{ opacity: 0, scale: 0.6 }}
    animate={{
      opacity: [0, 1, 1, 1, 1, 1, 0],
      scale: [0.6, 1, 1, 0.86, 1.08, 1, 1.35],
      x: [0, 0, 0, -2, 2, 0, 0],
    }}
    transition={{
      duration: SHIELD_BREAK_S - (ARROW_HOLD_S - 0.25) + 0.2,
      delay: ARROW_HOLD_S - 0.25,
      // Sube, espera, golpe (aplasta y rebota), aguanta, estalla
      times: [0, 0.15, 0.34, 0.4, 0.48, 0.82, 1],
    }}
  />
);

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
