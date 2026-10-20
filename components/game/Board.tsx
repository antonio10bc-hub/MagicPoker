import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, animate, useMotionValue } from 'framer-motion';
import { clsx } from 'clsx';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { BoardSlot, Card as CardType, Owner } from '@/types';
import { useGameLayout } from '@/components/pixel/Stage';
import { BoardGeometry } from '@/theme/layout';
import { CARD_SIZE, INK, PALETTE } from '@/theme/tokens';
import { useTranslations } from '@/lib/i18n';
import { getTargetIndices, RANKS } from '@/lib/game-utils';
import { haptic, playSfx } from '@/lib/sounds';
import { ACTIVE_THEME } from '@/themes';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { STAR } from '@/components/pixel/sprites';
import { JOKER_DRAW_BONUS } from '@/lib/constants';
import { WavyText } from '@/components/pixel/ui';
import { FxLayer } from '@/components/fx/FxLayer';
import { fx } from '@/components/fx/fxStore';
import { ARROW_HOLD_S, Card, DOUBLE_LUNGE_S, SealBadge } from './Card';
import { CombatDirector } from './CombatDirector';
import { BoardHints } from './BoardHints';
import { AttackArrows, useArrowsVisible } from './AttackArrows';

const { Diorama } = ACTIVE_THEME;

// --- CÁMARA 3D ---
// El tablero es UN plano inclinado en perspectiva (sin preserve-3d dentro): así el orden
// de pintado y de clic es el normal del DOM. En la pelea la cámara se inclina más.
const TILT_IDLE = 14;
const TILT_FIGHT = 20;
const PERSPECTIVE = 650;

/** Hueco: un rebaje oscuro en la piedra; si se puede jugar, la niebla lo ilumina */
const SlotTile = ({ x, y, highlight }: { x: number; y: number; highlight: boolean }) => (
  <div
    className={highlight ? 'absolute px-round anim-slot-glow' : 'absolute px-round'}
    style={{
      left: x - 1, top: y - 1, width: CARD_SIZE.width + 2, height: CARD_SIZE.height + 2,
      background: highlight
        ? 'radial-gradient(ellipse 70% 60% at 50% 70%, rgba(237,235,224,0.38) 0%, rgba(185,207,200,0.14) 60%, rgba(11,13,12,0.35) 100%)'
        : 'rgba(11,13,12,0.45)',
      boxShadow: 'inset 0 2px 4px rgba(11,13,12,0.8), inset 0 0 0 1px rgba(185,207,200,0.07)',
      transition: 'background 0.2s ease',
    }}
  />
);

/**
 * Patrón de ataque de la carta seleccionada, dibujado dentro de cada hueco libre: tres
 * flechas (diagonal izquierda, frente, diagonal derecha) encendidas según golpee. Así
 * se ve a dónde atacaría antes de soltarla, también en táctil (sin "hover").
 */
const PatternGlyph = ({ card }: { card: CardType }) => {
  const def = RANKS[card.rank];
  if (def.wipesBoard) return <PixelSprite sprite={STAR} scale={2} tint={INK.cream} />;
  if (!def.attack) return <span className="font-display text-outline" style={{ fontSize: 16 }}>+{JOKER_DRAW_BONUS}</span>;
  const random = def.attack.mode === 'random-one';
  const color = random ? INK.mint : INK.cream;
  // Flecha que sale de la base del hueco hacia arriba, inclinada según su casilla
  const arrow = (offset: number) => {
    const on = def.attack!.offsets.includes(offset);
    const angle = offset * 38;
    return (
      <g key={offset} transform={`rotate(${angle} 14 22)`} opacity={on ? 1 : 0.18}>
        <path d="M14 21 L14 7" stroke={on ? color : INK.teal} strokeWidth={2.4} strokeLinecap="round" strokeDasharray={on && random ? '2.5 2.5' : undefined} />
        <path d="M9.5 10.5 L14 4 L18.5 10.5 Z" fill={on ? color : INK.teal} />
      </g>
    );
  };
  return (
    <svg width={28} height={24} viewBox="0 0 28 24" className="bloom-cream" aria-hidden>
      {[-1, 0, 1].map(arrow)}
    </svg>
  );
};

/** Polvo al aterrizar una carta */
const landingDust = (x: number, y: number) => {
  fx.emit({ kind: 'particles', x: x + CARD_SIZE.width / 2, y: y + CARD_SIZE.height - 2, colors: [PALETTE.white, PALETTE.pavement, PALETTE.floorPattern], count: 10, speed: 22, spread: Math.PI, angle: -Math.PI / 2, gravity: 20, size: [1, 2], life: 450 });
  fx.emit({ kind: 'particles', x: x + CARD_SIZE.width / 2, y: y + 2, colors: [PALETTE.white, PALETTE.pavement], count: 6, speed: 16, spread: Math.PI, angle: Math.PI / 2, gravity: 0, size: [1, 2], life: 400 });
};

interface PlacedCardProps {
  card: CardType;
  owner: Owner;
  x: number;
  y: number;
  /** Embestida hacia el objetivo durante el combate */
  lunge: { dx: number; dy: number } | null;
  /** Flechas de ataque encendidas para esta carta */
  arrowsOn: boolean;
  onToggleArrows: (cardId: string) => void;
  /** Llega desde otro hueco movida por un sello (CAMBIO o ¡ROBO!): desplazamiento de origen */
  from: Shift | null;
}

/** De dónde viene una carta que un sello ha cambiado de sitio (cross: ha cambiado de bando) */
type Shift = { dx: number; dy: number; cross: boolean };

/** Al salir de un hueco: si la carta solo se ha movido a otro, desaparece sin animación */
const exitVariants = {
  gone: ({ moved, voided, owner }: { moved: boolean; voided: boolean; owner: Owner }) =>
    moved ? { opacity: 0, transition: { duration: 0 } }
      : voided ? { scale: 0, rotateZ: 360, opacity: 0, transition: { duration: 0.45, ease: 'backIn' as const } }
        : { y: 18, scale: 0.6, rotateZ: owner === 'player' ? -25 : 25, opacity: 0, transition: { duration: 0.35, ease: 'easeIn' as const } },
};

/**
 * Carta en mesa: aparece sobre su propio hueco, cae un poco, se "aplasta" al aterrizar
 * y levanta polvo. No vuela desde la mano: viajar dentro del tablero inclinado en 3D
 * se pinta mal en Safari de iOS (la carta salía diminuta en una esquina).
 */
const PlacedCard = ({ card, owner, x, y, lunge, arrowsOn, onToggleArrows, from: shift }: PlacedCardProps) => {
  // Solo cuenta al aparecer: luego el tablero cambia y no debe repetir la entrada
  const [from] = useState(shift);
  const dead = card.isTakingDamage || card.isVoided;
  // Movida por un sello: no "aterriza", se desliza desde su hueco anterior
  const landed = useRef(!!from);
  // El sello de ataque golpea dos veces: doble embestida
  const double = card.seal === 'double';

  return (
    <motion.div
      className={clsx('absolute', from ? 'z-[12]' : 'z-10')}
      data-card={card.id}
      style={{ left: x, top: y, width: CARD_SIZE.width, height: CARD_SIZE.height }}
      variants={exitVariants}
      // Solo 2D (translate, escala, giro y opacidad) sobre su hueco
      {...(from ? {
        // ¡ROBO!: cruza el tablero en arco; CAMBIO: se desliza de lado
        initial: { x: from.dx, y: from.dy, scale: 1, opacity: 1 },
        animate: from.cross
          ? { x: [from.dx, from.dx / 2 + 26, 0], y: [from.dy, from.dy / 2, 0], scale: [1, 1.25, 1], rotateZ: [0, 14, 0] }
          : { x: [from.dx, 0], y: [from.dy, 0], scale: [1, 1.12, 1], rotateZ: [0, from.dx > 0 ? -6 : 6, 0] },
        transition: { duration: 0.5, ease: 'easeInOut' },
      } : {
        initial: { y: -22, scale: 1.12, rotateZ: owner === 'player' ? -3 : 4, opacity: 0 },
        animate: { y: [-22, -26, 0], scale: [1.12, 1.16, 1], rotateZ: [owner === 'player' ? -3 : 4, owner === 'player' ? -1 : 2, 0], opacity: [0, 1, 1] },
        transition: { duration: 0.3, times: [0, 0.35, 1], ease: [0.3, 0.1, 0.4, 1] },
      })}
      onAnimationStart={() => { if (!landed.current) playSfx('whoosh', 0.8); }}
      onAnimationComplete={() => {
        if (landed.current) return;
        landed.current = true;
        playSfx('place');
        landingDust(x, y);
        fx.shake(owner === 'player' ? 1.2 : 0.8);
        if (owner === 'player') haptic('place');
      }}
      exit="gone"
    >
      {/* Estela verde mientras un sello la mueve */}
      {from && (
        <motion.div className="absolute pointer-events-none px-round-2 bloom-volt" style={{ inset: -2, boxShadow: '0 0 0 2px var(--ink-volt), 0 0 14px 5px rgba(125,255,43,0.6)' }}
          initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.4, delay: 0.45 }} />
      )}
      {/* Sombra: crece al acercarse al suelo */}
      <motion.div
        className="absolute"
        style={{ left: 2, top: 3, width: CARD_SIZE.width, height: CARD_SIZE.height, background: 'var(--c-shadow)' }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: dead ? 0.3 : 1, scale: 1 }}
        transition={{ duration: 0.42 }}
      />
      {/* Aplastamiento al aterrizar + embestida en combate */}
      <motion.div
        key={lunge ? 'lunge' : 'rest'}
        className="absolute inset-0"
        style={{ transformOrigin: '50% 100%' }}
        initial={lunge ? { x: 0, y: 0 } : { scaleY: 1, scaleX: 1 }}
        animate={lunge
          ? double
            // Dos golpes: el primero llega a la vez que los demás, el segundo justo después
            ? { x: [0, -lunge.dx * 0.15, lunge.dx, lunge.dx * 0.2, lunge.dx, 0], y: [0, -lunge.dy * 0.2, lunge.dy, lunge.dy * 0.15, lunge.dy * 1.1, 0], rotateZ: [0, -2, 4, -3, 5, 0] }
            : { x: [0, -lunge.dx * 0.15, lunge.dx, 0], y: [0, -lunge.dy * 0.2, lunge.dy, 0], rotateZ: [0, -2, 4, 0] }
          : from ? { scaleY: 1, scaleX: 1 } : { scaleY: [1, 1, 0.82, 1.06, 1], scaleX: [1, 1, 1.12, 0.97, 1] }}
        transition={lunge
          ? double
            ? { duration: DOUBLE_LUNGE_S, times: [0, 0.2, 0.36, 0.55, 0.75, 1], ease: 'easeInOut', delay: ARROW_HOLD_S }
            : { duration: 0.4, times: [0, 0.3, 0.55, 1], ease: 'easeInOut', delay: ARROW_HOLD_S }
          : { duration: 0.62, times: [0, 0.66, 0.76, 0.88, 1] }}
      >
        {/* Flotación suave en la mesa (se detiene durante el combate) */}
        <div
          className={lunge || dead ? undefined : 'anim-float'}
          style={{ animationDuration: `${3 + (card.value % 3) * 0.4}s`, animationDelay: `${(card.value % 5) * -0.5}s` }}
        >
          {/* Boca abajo no se sabe a dónde ataca: solo se pueden encender las cartas visibles */}
          <Card card={card} onClick={owner === 'player' || card.isFaceUp ? () => onToggleArrows(card.id) : undefined} />
          {/* Brillo del color del bando mientras sus flechas están encendidas */}
          <AnimatePresence>
            {arrowsOn && (
              <motion.div className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                <div className="absolute inset-0 rounded-[3px] anim-pulse" style={{ animationDuration: '1.6s', boxShadow: owner === 'player'
                  ? '0 0 0 1px rgba(237,235,224,0.85), 0 0 9px 2px rgba(237,235,224,0.45)'
                  : '0 0 0 1px rgba(255,74,28,0.95), 0 0 10px 3px rgba(255,74,28,0.6)' }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};

/**
 * Cinta "¡PELEA!": entra de golpe, se mantiene un instante y se va ANTES de que las
 * cartas embistan (la lógica resuelve a los 800 ms), para no tapar la acción.
 */
const FightRibbon = ({ geo }: { geo: BoardGeometry }) => {
  const t = useTranslations();
  const c = geo.centerLine;
  return (
    <motion.div
      className="absolute z-30 flex items-center justify-center text-title pointer-events-none bloom"
      style={{ left: c.x, top: c.y - 4, width: c.w, height: c.h + 8, background: 'radial-gradient(ellipse 60% 70% at 50% 50%, var(--ink-ember) 0%, var(--ink-orange) 70%)', borderRadius: 2 }}
      initial={{ scaleX: 0.2, scaleY: 3, opacity: 0, rotateZ: -6, filter: 'blur(3px)' }}
      animate={{ scaleX: [0.2, 1.05, 1, 1.4], scaleY: [3, 1, 1, 0], opacity: [0, 1, 1, 0], rotateZ: [-6, 2, 0, 0], filter: ['blur(3px)', 'blur(0px)', 'blur(0px)', 'blur(2px)'] }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
      transition={{ duration: 0.7, times: [0, 0.18, 0.78, 1], ease: 'easeOut' }}
    >
      <span className="text-ink">
        <WavyText text={t.fight} />
      </span>
    </motion.div>
  );
};

interface BoardProps {
  selectedCardId: string | null;
  onSlotClick: (slotIndex: number) => void;
  /** Hueco sobre el que se está arrastrando una carta (vista previa) */
  dragOverSlot: number | null;
  /** Tutorial: el único hueco válido (se señala aunque no haya carta elegida) */
  onlySlot?: number;
}

export const Board = ({ selectedCardId, onSlotClick, dragOverSlot, onlySlot }: BoardProps) => {
  const { board: geo } = useGameLayout();
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  // Cartas de la mesa con las flechas encendidas (se enciende/apaga tocándolas)
  const [arrowCards, setArrowCards] = useState<ReadonlySet<string>>(() => new Set());
  const toggleArrows = useCallback((cardId: string) => {
    setArrowCards(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId); else next.add(cardId);
      return next;
    });
  }, []);
  const { playerBoard, opponentBoard, combat, phase, selectedCard } = useGameStore(useShallow(s => ({
    playerBoard: s.player.board,
    opponentBoard: s.opponent.board,
    combat: s.pendingCombatResult,
    phase: s.phase,
    selectedCard: s.player.hand.find(c => c.id === selectedCardId) ?? null,
  })));

  const isPlacementPhase = phase === 'placement';
  const arrowsVisible = useArrowsVisible(combat);
  const isFighting = phase === 'combat' || phase === 'combat-reveal';
  const isTargeting = !!selectedCard && isPlacementPhase;
  const sealing = selectedCard?.rank === 'SEAL';
  const activeSlot = dragOverSlot ?? hoveredSlot;
  const preview = useMemo(
    () => (isTargeting && selectedCard && !sealing && activeSlot !== null && !playerBoard[activeSlot].card ? { card: selectedCard, slotIndex: activeSlot } : null),
    [isTargeting, selectedCard, sealing, activeSlot, playerBoard]
  );

  // Cámara: se inclina más durante la pelea (spring suave)
  const tilt = useMotionValue(TILT_IDLE);
  useEffect(() => {
    const controls = animate(tilt, isFighting ? TILT_FIGHT : TILT_IDLE, { type: 'spring', stiffness: 120, damping: 18 });
    return () => controls.stop();
  }, [isFighting, tilt]);

  const d = geo.diorama;
  const origin = `${d.x + d.w / 2}px ${d.y + d.h / 2}px`;
  const pitch = geo.slots.player[1].x - geo.slots.player[0].x;

  // Cartas que un sello acaba de mover: se compara con el tablero anterior
  type Boards = Record<Owner, BoardSlot[]>;
  const [boards, setBoards] = useState<{ now: Boards; before: Boards | null }>({ now: { player: playerBoard, opponent: opponentBoard }, before: null });
  if (boards.now.player !== playerBoard || boards.now.opponent !== opponentBoard) {
    setBoards({ now: { player: playerBoard, opponent: opponentBoard }, before: boards.now });
  }
  const before = boards.before;
  const lastPos = useMemo(() => {
    const pos = new Map<string, { owner: Owner; index: number }>();
    if (before) (['player', 'opponent'] as Owner[]).forEach(owner =>
      before[owner].forEach(s => { if (s.card) pos.set(s.card.id, { owner, index: s.index }); }));
    return pos;
  }, [before]);
  const currentIds = new Set([...playerBoard, ...opponentBoard].flatMap(s => (s.card ? [s.card.id] : [])));
  const shiftFor = (slot: BoardSlot, owner: Owner): Shift | null => {
    const prev = slot.card && lastPos.get(slot.card.id);
    if (!prev || (prev.owner === owner && prev.index === slot.index)) return null;
    const a = geo.slots[prev.owner][prev.index];
    const b = geo.slots[owner][slot.index];
    return { dx: a.x - b.x, dy: a.y - b.y, cross: prev.owner !== owner };
  };
  /** Cómo sale la carta que había en este hueco: movida (sin animación), anulada o rota */
  const exitFor = (owner: Owner, index: number) => {
    const old = before?.[owner][index].card;
    return { moved: !!old && currentIds.has(old.id), voided: !!old?.isVoided, owner };
  };

  // Embestidas: cada carta con patrón de ataque se lanza hacia su objetivo
  const lungeFor = (slot: BoardSlot, owner: Owner) => {
    if (!combat || combat.voidedCardIds.length > 0 || !slot.card || !RANKS[slot.card.rank].attack) return null;
    const targets = getTargetIndices(slot.index, slot.card.rank);
    if (targets.length === 0) return null;
    const avg = targets.reduce((a, b) => a + b, 0) / targets.length;
    return { dx: Math.round((avg - slot.index) * pitch * 0.45), dy: owner === 'player' ? -16 : 16 };
  };

  const renderSide = (cards: BoardSlot[], owner: Owner) =>
    cards.map(slot => {
      const { x, y } = geo.slots[owner][slot.index];
      // Carta normal → hueco vacío; carta de sello → carta propia sin sello
      const fits = sealing ? !!slot.card && !slot.card.seal : !slot.card;
      const canTarget = owner === 'player' && fits && isTargeting && (onlySlot === undefined || onlySlot === slot.index);
      const tutorialHint = owner === 'player' && onlySlot === slot.index && !slot.card && isPlacementPhase;
      const showGhost = canTarget && activeSlot === slot.index && selectedCard;
      return (
        <div key={`${owner}-${slot.index}`}>
          <SlotTile x={x} y={y} highlight={canTarget && !sealing} />
          {/* Tutorial: "aquí" — marco que late sobre el hueco que pide el paso */}
          {tutorialHint && (
            <div className="absolute pointer-events-none px-round anim-pulse z-[19]"
              style={{ left: x - 3, top: y - 3, width: CARD_SIZE.width + 6, height: CARD_SIZE.height + 6,
                boxShadow: '0 0 0 1px var(--ink-cream), 0 0 12px 3px rgba(255,74,28,0.65)' }} />
          )}
          {canTarget && (
            <button
              aria-label={`slot ${slot.index + 1}`}
              data-slot={slot.index}
              onClick={() => { setHoveredSlot(null); onSlotClick(slot.index); }}
              onPointerEnter={() => { setHoveredSlot(slot.index); playSfx('hover'); }}
              onPointerLeave={() => setHoveredSlot(h => (h === slot.index ? null : h))}
              className="absolute z-20 flex items-center justify-center cursor-pointer"
              style={{ left: x, top: y, width: CARD_SIZE.width, height: CARD_SIZE.height }}
            >
              {/* El contenido no captura el puntero: el clic siempre llega al botón,
                  aunque al pasar por encima cambie de cursor a vista previa */}
              {sealing && selectedCard?.seal ? (
                // Sello: contorno verde que late sobre la carta; al apuntarla, el sello ya puesto
                <div className={showGhost ? 'absolute inset-0 pointer-events-none px-round' : 'absolute inset-0 pointer-events-none px-round anim-pulse'}
                  style={{ inset: -2, boxShadow: showGhost ? '0 0 0 2px var(--ink-volt), 0 0 12px 4px rgba(125,255,43,0.6)' : '0 0 0 1px var(--ink-volt), 0 0 8px 2px rgba(125,255,43,0.4)' }}>
                  {showGhost && <SealBadge seal={selectedCard.seal} pulse />}
                </div>
              ) : showGhost
                ? <div className="pointer-events-none" style={{ opacity: 0.55 }}><Card card={selectedCard} /></div>
                : <span className="anim-bob pointer-events-none">{selectedCard && <PatternGlyph card={selectedCard} />}</span>}
              {/* Destino confirmado: marco verde suave que late sobre la vista previa */}
              {showGhost && !sealing && (
                <motion.div
                  className="absolute pointer-events-none px-round"
                  style={{ inset: -2, boxShadow: '0 0 0 1px rgba(255,74,28,0.9), 0 0 10px 3px rgba(255,74,28,0.55), inset 0 0 8px rgba(242,101,42,0.45)',
                    background: 'rgba(255,74,28,0.12)' }}
                  initial={{ opacity: 0, scale: 1.12 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                />
              )}
            </button>
          )}
          <AnimatePresence custom={exitFor(owner, slot.index)}>
            {slot.card && (
              <PlacedCard
                from={shiftFor(slot, owner)}
                key={slot.card.id}
                card={slot.card}
                owner={owner}
                x={x}
                y={y}
                lunge={lungeFor(slot, owner)}
                arrowsOn={arrowCards.has(slot.card.id) && arrowsVisible}
                onToggleArrows={id => { playSfx(arrowCards.has(id) ? 'deselect' : 'select', 0.7); toggleArrows(id); }}
              />
            )}
          </AnimatePresence>
        </div>
      );
    });

  return (
    <div className="absolute inset-0" style={{ perspective: PERSPECTIVE, perspectiveOrigin: origin }}>
      <motion.div
        className="absolute inset-0"
        style={{ rotateX: tilt, transformOrigin: origin }}
      >
        <Diorama board={geo} />
        {renderSide(opponentBoard, 'opponent')}
        {renderSide(playerBoard, 'player')}
        <AttackArrows geo={geo} playerBoard={playerBoard} opponentBoard={opponentBoard} phase={phase} combat={combat} preview={preview} shown={arrowCards} />
        <BoardHints geo={geo} playerBoard={playerBoard} opponentBoard={opponentBoard} phase={phase} combat={combat} preview={preview} shown={arrowCards} />
        <AnimatePresence>{isFighting && <FightRibbon geo={geo} />}</AnimatePresence>
        <FxLayer layer="board" />
        <CombatDirector geo={geo} />
      </motion.div>
    </div>
  );
};

