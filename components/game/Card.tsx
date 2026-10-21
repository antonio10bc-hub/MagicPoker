import { memo, ReactNode, useEffect, useState } from 'react';
import { Card as CardType, Owner } from '@/types';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { RANKS } from '@/lib/game-utils';
import { pausableTimeout } from '@/lib/clock';
import { JOKER_DRAW_BONUS } from '@/lib/constants';
import { CARD_SIZE, INK, TEAM } from '@/theme/tokens';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { CHARACTERS, EMBLEM_OPPONENT, EMBLEM_PLAYER, PIP, SEAL_ICONS, STAR } from '@/components/pixel/sprites';
import { useTranslations, Translations } from '@/lib/i18n';
import { SealId } from '@/types';
import { CARD_BACK_TILE, WINDOW_TILE, patternUri } from '@/components/pixel/patterns';
import { BOSS_SPRITES, CASTLE_SPRITE, MERCHANT_SPRITE } from '@/components/pixel/bosses';
import { CASTLE_BACKS, CastleBack } from '@/lib/castle';
import { BOSSES } from '@/lib/bosses';
import { DEFAULT_BACK, usePlayerBack } from '@/lib/cosmetics';
import { useGameStore } from '@/store/useGameStore';

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
  const text = (v: string) => <span className="text-outline font-display leading-[10px] pt-[1px]">{v}</span>;
  if (def.wipesBoard) {
    content = <PixelSprite sprite={STAR} tint={INK.cream} />;
  } else if (card.rank === 'JOKER') {
    content = text(`+${JOKER_DRAW_BONUS}`);
  } else if (!def.attack) {
    // Torre: no ataca
    content = text('–');
  } else if (def.copiesFront) {
    // Bufón: copia el ataque de la de enfrente
    content = text('?');
  } else if (def.attack.offsets.some(o => Math.abs(o) > 1)) {
    // Caballero: salta dos huecos
    content = text('±2');
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
 *  (sello de revelar): la cifra baja en uno y la píldora se enciende en brasa. Mejorada
 *  por el mercader: azul eléctrico. */
const ValueBadge = ({ value, exposed, boosted }: { value: number; exposed?: boolean; boosted?: boolean }) => (
  <div className={clsx('absolute flex items-center justify-center font-display', exposed || boosted ? 'text-ink' : 'text-outline', boosted && !exposed && 'bloom-azure')}
    style={{ left: 3, top: 44, width: 17, height: 10, borderRadius: 2, background: exposed ? 'var(--ink-ember)' : boosted ? 'var(--ink-azure)' : 'rgba(11,13,12,0.85)', fontSize: 11 }}>
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

/** Carta del mercader: masa azul eléctrico con la ventana bañada en azul */
const AZURE_WASH = 'linear-gradient(rgba(46,155,255,0.5), rgba(46,155,255,0.5))';
const MERCHANT_LOOK = {
  body: 'radial-gradient(ellipse 80% 70% at 50% 45%, #A6D8FF 0%, var(--ink-azure) 55%, #1253B0 100%)',
  window: `radial-gradient(ellipse 60% 55% at 50% 60%, rgba(226,243,255,0.6) 0%, rgba(46,155,255,0) 70%), ${AZURE_WASH}, ${patternUri('window', WINDOW_TILE)}`,
};

// --- DORSO ---
// Sin dibujo: una masa de grano del color del bando cuyos bordes se deshacen
// --- MOTIVOS GEOMÉTRICOS DE LOS DORSOS ---
// Líneas finas sobre el grano, como un dorso de baraja impreso: marco doble y una
// figura alrededor del centro (cada jefe la suya).
type Motif = 'frame' | 'diamond' | 'circles' | 'chevrons' | 'rays';
const MOTIFS: Motif[] = ['diamond', 'circles', 'chevrons', 'rays'];

const BackMotif = ({ kind, color }: { kind: Motif; color: string }) => (
  <svg className="absolute inset-0" width={40} height={56} viewBox="0 0 40 56" fill="none" stroke={color} strokeWidth={1} aria-hidden>
    {/* Marco doble */}
    <rect x={2.5} y={2.5} width={35} height={51} rx={1.5} />
    <rect x={4.5} y={4.5} width={31} height={47} rx={1} strokeOpacity={0.6} />
    {kind === 'diamond' && (
      <>
        <path d="M20 9 L33 28 L20 47 L7 28 Z" />
        <path d="M20 13 L30 28 L20 43 L10 28 Z" strokeOpacity={0.5} />
        {[[8, 9], [32, 9], [8, 47], [32, 47]].map(([x, y]) => <path key={`${x}-${y}`} d={`M${x} ${y - 2} L${x + 2} ${y} L${x} ${y + 2} L${x - 2} ${y} Z`} fill={color} />)}
      </>
    )}
    {kind === 'circles' && (
      <>
        <circle cx={20} cy={28} r={15} />
        <circle cx={20} cy={28} r={12} strokeOpacity={0.5} />
        {[[8, 9], [32, 9], [8, 47], [32, 47]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.5} fill={color} />)}
      </>
    )}
    {kind === 'chevrons' && (
      <>
        <path d="M8 9 L20 15 L32 9 M8 13 L20 19 L32 13" />
        <path d="M8 47 L20 41 L32 47 M8 43 L20 37 L32 43" />
        <path d="M8 22 L8 34 M32 22 L32 34" strokeOpacity={0.6} />
      </>
    )}
    {kind === 'rays' && (
      <>
        <circle cx={20} cy={28} r={11} strokeOpacity={0.6} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <path key={i} d={`M${20 + Math.cos(a) * 13} ${28 + Math.sin(a) * 13} L${20 + Math.cos(a) * 17} ${28 + Math.sin(a) * 17}`} />;
        })}
      </>
    )}
  </svg>
);

/** Dorso dorado del jefe secreto */
const GOLD = 'radial-gradient(ellipse 70% 60% at 50% 45%, #FFE9A8 0%, #E8B64A 50%, #9A6B1C 100%)';

/**
 * Dorso: masa de grano del color del bando. Con un dorso de jefe (`back`), en vez del
 * emblema lleva la silueta de ese jefe y su sello en una esquina; el del jefe
 * secreto, además, es dorado.
 */
/** Dorsos del Castillo: castillo (carmesí), mercader (azul) y corona (oro y carmesí) */
const SpecialBack = ({ id }: { id: CastleBack }) => {
  const look = {
    castle: { bg: 'radial-gradient(ellipse 70% 60% at 50% 45%, #FF6A86 0%, var(--ink-crimson) 45%, #6E0E22 100%)', glow: 'bloom-crimson', line: 'rgba(11,13,12,0.55)' },
    merchant: { bg: 'radial-gradient(ellipse 70% 60% at 50% 45%, #A6D8FF 0%, var(--ink-azure) 50%, #0E3E86 100%)', glow: 'bloom-azure', line: 'rgba(11,13,12,0.5)' },
    crown: { bg: 'radial-gradient(ellipse 70% 60% at 50% 45%, #FFE9A8 0%, #E8B64A 40%, #8A1430 100%)', glow: 'bloom-gold', line: 'rgba(11,13,12,0.6)' },
  }[id];
  return (
    <div className={clsx('px-round-2 absolute inset-0 overflow-hidden', look.glow)} style={{ background: look.bg }}>
      {id === 'crown' && <div className="absolute inset-0" style={{ background: 'repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,31,75,0.35) 0deg 7deg, transparent 7deg 20deg)' }} />}
      <BackMotif kind={id === 'castle' ? 'chevrons' : id === 'merchant' ? 'circles' : 'frame'} color={look.line} />
      {id === 'castle' && <PixelSprite sprite={CASTLE_SPRITE} tint={INK.black} style={{ position: 'absolute', left: 12, top: 16, width: 16, height: 20.5 }} />}
      {id === 'merchant' && (
        <>
          <PixelSprite sprite={MERCHANT_SPRITE.body} tint={INK.black} style={{ position: 'absolute', left: 12, top: 16, width: 16, height: 21 }} />
          <PixelSprite sprite={MERCHANT_SPRITE.seal} tint={INK.cream} style={{ position: 'absolute', left: 12, top: 16, width: 16, height: 21 }} />
        </>
      )}
      {id === 'crown' && (
        <>
          <div className="absolute" style={{ left: 2, top: 10, width: 36, height: 36, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,246,214,0.9) 0%, rgba(255,233,168,0.45) 45%, transparent 72%)' }} />
          <PixelSprite sprite={BOSS_SPRITES.sovereign.body} tint={INK.black} style={{ position: 'absolute', left: 12, top: 15.5, width: 16, height: 25 }} />
          <div className="absolute" style={{ left: 16.5, top: 4 }}><PixelSprite sprite={STAR} tint={INK.crimson} /></div>
          <div className="absolute" style={{ left: 16.5, bottom: 4 }}><PixelSprite sprite={STAR} tint={INK.crimson} /></div>
        </>
      )}
    </div>
  );
};

export const CardBack = ({ owner, sealed, back = DEFAULT_BACK }: { owner: Owner; sealed?: boolean; back?: string }) => {
  if (!sealed && (CASTLE_BACKS as readonly string[]).includes(back)) return <SpecialBack id={back as CastleBack} />;
  const boss = back !== DEFAULT_BACK ? BOSSES.find(b => b.id === back) : undefined;
  const gold = !!boss?.secret && !sealed;
  const sprite = boss && BOSS_SPRITES[boss.id];
  return (
  <div className={clsx('px-round-2 absolute inset-0', sealed ? 'bloom-volt' : gold ? 'bloom-gold' : owner === 'opponent' && 'bloom')}
    style={{ background: sealed ? 'var(--ink-volt-dark)' : gold ? GOLD : owner === 'opponent' ? 'rgba(255,74,28,0.35)' : 'var(--ink-slate)' }}>
    <div className="absolute inset-0" style={{
      backgroundImage: sealed
        ? `radial-gradient(ellipse 55% 50% at 50% 50%, rgba(216,255,154,0.6) 0%, transparent 70%), ${VOLT_WASH}, ${patternUri('card-back', CARD_BACK_TILE, owner)}`
        : `radial-gradient(ellipse 55% 50% at 50% 50%, ${owner === 'opponent' ? 'rgba(237,235,224,0.45)' : 'rgba(94,122,118,0.35)'} 0%, transparent 70%), ${patternUri('card-back', CARD_BACK_TILE, owner)}`,
      backgroundSize: sealed ? '100% 100%, 100% 100%, 16px' : '100% 100%, 16px',
      WebkitMaskImage: 'radial-gradient(ellipse 75% 70% at 50% 50%, #000 55%, transparent 100%)',
      maskImage: 'radial-gradient(ellipse 75% 70% at 50% 50%, #000 55%, transparent 100%)',
      // Con un dorso de jefe el grano baja para que manden las líneas del motivo
      opacity: boss && !sealed ? 0.45 : 1,
    }} />
    {sprite && boss ? (
      boss.secret ? (
        // Jefe secreto: oro con rayos, un aura grande y la silueta en el centro exacto
        <>
          <div className="absolute inset-0 rounded-[2px]" style={{ background: 'repeating-conic-gradient(from 0deg at 50% 50%, rgba(11,13,12,0.16) 0deg 8deg, transparent 8deg 22deg)' }} />
          <div className="absolute" style={{ left: 2, top: 10, width: 36, height: 36, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,246,214,0.95) 0%, rgba(255,233,168,0.55) 45%, transparent 72%)' }} />
          <BackMotif kind="frame" color="rgba(11,13,12,0.6)" />
          <PixelSprite sprite={sprite.body} tint={INK.black} style={{ position: 'absolute', left: 12, top: 15.5, width: 16, height: 25 }} />
          <div className="absolute" style={{ left: 16.5, top: 4 }}><PixelSprite sprite={STAR} tint={INK.black} /></div>
          <div className="absolute" style={{ left: 16.5, bottom: 4 }}><PixelSprite sprite={STAR} tint={INK.black} /></div>
        </>
      ) : (
        // Dorso de jefe: un motivo geométrico (según el jefe), su silueta en el centro y su sello
        <>
          <BackMotif kind={MOTIFS[BOSSES.indexOf(boss) % MOTIFS.length]} color={owner === 'opponent' ? 'rgba(11,13,12,0.6)' : 'rgba(237,235,224,0.6)'} />
          <PixelSprite sprite={sprite.body} tint={INK.black} style={{ position: 'absolute', left: 13, top: 19, width: 14, height: 18 }} />
          {boss.seal && (
            <div className="absolute" style={{ right: 4, bottom: 4, opacity: 0.85 }}>
              <PixelSprite sprite={SEAL_ICONS[boss.seal]} tint={owner === 'opponent' ? INK.black : INK.cream} />
            </div>
          )}
        </>
      )
    ) : (
      // Emblema del bando en silueta
      <div className="absolute flex items-center justify-center" style={{ left: 12, top: 20, width: 16, height: 16 }}>
        <PixelSprite sprite={EMBLEMS[owner]} tint={INK.black} />
      </div>
    )}
  </div>
  );
};

/** Dorso que llevan las cartas: el tuyo el que elijas, el rival el de su jefe */
const useCardBack = (owner: Owner) => {
  const mine = usePlayerBack();
  const theirs = useGameStore(s => (s.tutorialStep === null && s.screen === 'game' ? BOSSES[s.bossIndex]?.id : undefined));
  return owner === 'player' ? mine : theirs ?? DEFAULT_BACK;
};

// --- ANVERSO ---
/** Nombre corto de las cartas del Castillo (Bufón, Torre…) */
const CASTLE_NAME: Partial<Record<CardType['rank'], keyof Translations>> = {
  JESTER: 'idea_jester', TOWER: 'idea_tower', BOMB: 'idea_bomb', SPY: 'idea_spy', KNIGHT: 'idea_knight', PRIESTESS: 'idea_priestess',
  DRAGON: 'idea_dragon', HYDRA: 'idea_hydra', PHOENIX: 'idea_phoenix',
};

const CardFace = ({ card, sealed }: { card: CardType; sealed: boolean }) => {
  const t = useTranslations();
  if (card.rank === 'SEAL') return <SealCardFace seal={card.seal} merchant={card.merchant} />;
  const look = LOOK[card.owner];
  const character = CHARACTERS[card.rank];
  const tile = card.owner === 'opponent' ? '16px' : '8px';
  // Del mercader: azul eléctrico (si además lleva sello, manda el verde y queda un filo azul)
  const merchant = !!card.merchant;
  // Legendaria: además del azul, filo y brillo de oro y una estrella
  const legendary = !!RANKS[card.rank].legendary;
  return (
    <div className={clsx('px-round-2 absolute inset-0', sealed ? 'bloom-volt' : legendary ? 'bloom-gold' : merchant ? 'bloom-azure' : look.glow)}
      style={{
        background: sealed ? SEALED_LOOK.body : merchant || legendary ? MERCHANT_LOOK.body : look.body,
        boxShadow: legendary ? 'inset 0 0 0 1px var(--ink-gold), inset 0 0 0 2px rgba(232,182,74,0.35)'
          : sealed && merchant ? 'inset 0 0 0 1px var(--ink-azure), 0 0 5px 1px rgba(46,155,255,0.6)'
          : !sealed && !merchant && card.owner === 'player' ? '0 0 6px 1px rgba(237,235,224,0.14)' : undefined,
      }}>
      {legendary && (
        <div className="absolute z-10" style={{ right: 4, top: 4 }}>
          <PixelSprite sprite={STAR} tint={INK.gold} className="bloom-gold-shape" />
        </div>
      )}
      {/* Ventana de ilustración (ocupa casi toda la carta) */}
      <div className="absolute overflow-hidden" style={{
        left: 3, top: 3, width: 34, height: 39, borderRadius: 2,
        backgroundImage: sealed ? SEALED_LOOK.window(card.owner) : merchant || legendary ? MERCHANT_LOOK.window : look.window,
        backgroundSize: sealed || merchant || legendary ? `100% 100%, 100% 100%, ${tile}` : `100% 100%, ${tile}`,
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
            left: 3, top: 3, height: card.rank === 'JOKER' ? 11 : CASTLE_NAME[card.rank] ? 9 : 17, padding: '0 3px',
            fontSize: card.rank === 'JOKER' ? 11 : CASTLE_NAME[card.rank] ? 7 : 20,
            lineHeight: card.rank === 'JOKER' ? '11px' : CASTLE_NAME[card.rank] ? '9px' : '17px',
            paddingTop: card.rank === 'JOKER' ? 2 : CASTLE_NAME[card.rank] ? 1 : 3,
            color: 'var(--ink-black)', borderRadius: '2px 0 3px 0',
          }}>
          {CASTLE_NAME[card.rank] ? t[CASTLE_NAME[card.rank]!] : card.rank}
        </div>
      )}
      <ValueBadge value={card.value} exposed={card.isExposed} boosted={!!card.bonus} />
      <AttackBadge card={card} />
    </div>
  );
};

// --- SELLOS (verde eléctrico) ---
export const sealTag = (t: Translations, seal: SealId) => t[`seal_tag_${seal}` as keyof Translations];

/** Carta de sello: masa verde que brilla, con el icono en silueta y su nombre. El
 *  comodín (sin sello fijo) lleva un interrogante. */
const SealCardFace = ({ seal, merchant }: { seal?: SealId; merchant?: boolean }) => {
  const t = useTranslations();
  return (
    // El comodín que vende el mercader es azul eléctrico
    <div className={clsx('px-round-2 absolute inset-0', merchant ? 'bloom-azure' : 'bloom-volt')} style={{
      background: merchant ? MERCHANT_LOOK.body : 'radial-gradient(ellipse 70% 60% at 50% 42%, #D8FF9A 0%, var(--ink-volt) 45%, #4FC414 100%)',
    }}>
      <div className="absolute flex items-center justify-center" style={{ left: 3, top: 6, width: 34, height: 30 }}>
        {seal ? <PixelSprite sprite={SEAL_ICONS[seal]} tint={INK.black} scale={2} />
          : <span className="font-display" style={{ fontSize: 26, lineHeight: '26px', color: 'var(--ink-black)' }}>?</span>}
      </div>
      <div className="absolute left-0 right-0 flex justify-center font-display" style={{ top: 40, fontSize: 9, lineHeight: '9px', color: 'var(--ink-black)' }}>
        {seal ? sealTag(t, seal) : t.seal_tag_wild}
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
    const cancel = pausableTimeout(() => setBroken(true), SHIELD_BREAK_S * 1000);
    return () => { cancel(); setBroken(false); };
  }, [spent]);
  const sealed = !!card.seal && card.rank !== 'SEAL' && !(spent && broken);
  const back = useCardBack(card.owner);

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
        <div className="absolute inset-0" style={{ ...faceStyle, transform: 'rotateY(180deg)' }}><CardBack owner={card.owner} sealed={sealed} back={back} /></div>
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
