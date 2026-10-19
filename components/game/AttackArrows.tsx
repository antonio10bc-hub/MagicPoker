import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BoardSlot, Card as CardType, CombatResult, GamePhase, Owner } from '@/types';
import { BoardGeometry } from '@/theme/layout';
import { CARD_SIZE } from '@/theme/tokens';
import { getTargetIndices, RANKS } from '@/lib/game-utils';
import { useStage } from '@/components/pixel/Stage';

// --- FLECHAS DE ATAQUE ---
// Cada carta dibuja una flecha animada hacia cada hueco que golpeará:
//  · Estilo casi holograma: gruesas, translúcidas, con halo y franjas de luz.
//  · Salen del centro de la carta y van en línea recta al centro del hueco objetivo,
//    para que las diagonales (Reina, Rey, Príncipe) se lean sin ambigüedad.
//  · Tus cartas: doradas (durante la colocación y la pelea; también la vista previa).
//  · Cartas del rival: rojas, SOLO cuando están destapadas (al empezar la pelea).
//  · Príncipe (objetivo aleatorio): cian más tenue, "puede ir a cualquiera".
//  · Tras el golpe, las flechas que hicieron daño o destruyeron una carta brillan y
//    las demás se apagan: así se ve quién le hizo qué a quién.
//  · El As no dibuja flechas: una onda alrededor indica que barre todo el tablero.
// Solo lee el estado y las reglas (lib/game-utils); no cambia nada de la partida.

interface Arrow {
  key: string;
  owner: Owner;
  from: { x: number; y: number };
  to: { x: number; y: number };
  maybe: boolean;
  preview: boolean;
  /** null = aún no se sabe; true/false = tras el golpe, si hizo efecto */
  effective: boolean | null;
}

/** Tonos holográficos: claros y algo translúcidos para no tapar las cartas */
const COLOR: Record<Owner, string> = { player: '#FFD96A', opponent: '#FF6B66' };
const MAYBE_COLOR = '#8FE3FF';

interface AttackArrowsProps {
  geo: BoardGeometry;
  playerBoard: BoardSlot[];
  opponentBoard: BoardSlot[];
  phase: GamePhase;
  combat: CombatResult | null;
  preview: { card: CardType; slotIndex: number } | null;
}

const buildArrows = ({ geo, playerBoard, opponentBoard, phase, combat, preview }: AttackArrowsProps): { arrows: Arrow[]; wipers: { x: number; y: number; owner: Owner }[] } => {
  const arrows: Arrow[] = [];
  const wipers: { x: number; y: number; owner: Owner }[] = [];
  const fighting = phase === 'combat' || phase === 'combat-reveal';
  if (phase !== 'placement' && !fighting) return { arrows, wipers };

  const boards: Record<Owner, BoardSlot[]> = { player: playerBoard, opponent: opponentBoard };
  const dead = new Set(combat?.deadCardIds ?? []);

  const attackers: { card: CardType; index: number; owner: Owner; preview: boolean }[] = [];
  playerBoard.forEach(s => s.card && attackers.push({ card: s.card, index: s.index, owner: 'player', preview: false }));
  if (preview && phase === 'placement') attackers.push({ card: preview.card, index: preview.slotIndex, owner: 'player', preview: true });
  // Del rival solo lo que se ve: cartas destapadas
  opponentBoard.forEach(s => s.card?.isFaceUp && attackers.push({ card: s.card, index: s.index, owner: 'opponent', preview: false }));

  attackers.forEach(({ card, index, owner, preview: isPreview }) => {
    const def = RANKS[card.rank];
    const p = geo.slots[owner][index];
    if (def.wipesBoard) {
      wipers.push({ x: p.x + CARD_SIZE.width / 2, y: p.y + CARD_SIZE.height / 2, owner });
      return;
    }
    if (!def.attack) return;
    const enemy: Owner = owner === 'player' ? 'opponent' : 'player';
    const targets = getTargetIndices(index, card.rank);
    targets.forEach(t => {
      const q = geo.slots[enemy][t];
      const targetCard = boards[enemy][t].card;
      // De centro a centro y en línea recta: así las diagonales (Reina, Rey, Príncipe)
      // se leen sin ambigüedad. Salen del borde que mira al rival.
      const from = { x: p.x + CARD_SIZE.width / 2, y: owner === 'player' ? p.y + 10 : p.y + CARD_SIZE.height - 10 };
      const to = { x: q.x + CARD_SIZE.width / 2, y: q.y + CARD_SIZE.height / 2 };

      let effective: boolean | null = null;
      if (combat && phase === 'combat-reveal') {
        const hits = owner === 'player' ? combat.opponentEmptySlotsHit : combat.playerEmptySlotsHit;
        effective = targetCard ? dead.has(targetCard.id) && card.value >= targetCard.value : (hits[t] ?? 0) > 0;
      }
      arrows.push({ key: `${card.id}-${t}`, owner, from, to, maybe: def.attack!.mode === 'random-one', preview: isPreview, effective });
    });
  });
  return { arrows, wipers };
};

/** Línea recta que termina en la base de la punta, y punta orientada hacia el objetivo */
const geometry = (a: Arrow) => {
  const dx = a.to.x - a.from.x;
  const dy = a.to.y - a.from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const head = 9;
  const base = { x: a.to.x - ux * head, y: a.to.y - uy * head };
  const left = { x: base.x - uy * 6, y: base.y + ux * 6 };
  const right = { x: base.x + uy * 6, y: base.y - ux * 6 };
  return {
    d: `M ${a.from.x} ${a.from.y} L ${base.x} ${base.y}`,
    head: `${a.to.x},${a.to.y} ${left.x},${left.y} ${right.x},${right.y}`,
  };
};

/**
 * Flecha "casi holograma": trazo grueso y translúcido que se enciende hacia la punta,
 * halo difuso, franjas de luz que avanzan y un leve parpadeo. Sin contorno oscuro.
 */
const ArrowView = ({ a, index }: { a: Arrow; index: number }) => {
  const { d, head } = geometry(a);
  const color = a.maybe ? MAYBE_COLOR : COLOR[a.owner];
  const gradId = `arrow-grad-${a.key}`;
  const base = a.effective === false ? 0.14 : a.effective === true ? 0.95 : a.preview ? 0.5 : a.maybe ? 0.5 : 0.7;
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: [base * 0.85, base, base * 0.9] }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 1.6, repeat: Infinity, repeatType: 'mirror', delay: index * 0.04 }}
      style={{ mixBlendMode: 'screen' }}
    >
      <defs>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={a.from.x} y1={a.from.y} x2={a.to.x} y2={a.to.y}>
          <stop offset="0" stopColor={color} stopOpacity={0.05} />
          <stop offset="0.5" stopColor={color} stopOpacity={0.55} />
          <stop offset="1" stopColor={color} stopOpacity={0.95} />
        </linearGradient>
      </defs>
      {/* Halo difuso */}
      <path d={d} fill="none" stroke={`url(#${gradId})`} strokeWidth={9} strokeLinecap="round" filter="url(#arrow-glow)" opacity={0.6} />
      {/* Cuerpo grueso translúcido */}
      <path d={d} fill="none" stroke={`url(#${gradId})`} strokeWidth={a.effective ? 6 : 5} strokeLinecap="round" />
      {/* Franjas de luz que avanzan hacia el objetivo */}
      <path d={d} fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={a.maybe ? 1.5 : 2} strokeLinecap="round"
        strokeDasharray={a.maybe ? '1 6' : '2 7'} className="arrow-march" />
      <polygon points={head} fill={color} fillOpacity={0.85} stroke="#ffffff" strokeOpacity={0.7} strokeWidth={1} strokeLinejoin="round" filter="url(#arrow-glow)" />
    </motion.g>
  );
};

export const AttackArrows = (props: AttackArrowsProps) => {
  const { width, height } = useStage();
  const { arrows, wipers } = useMemo(() => buildArrows(props), [props]);

  return (
    <svg className="absolute left-0 top-0 pointer-events-none z-[12]" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        <filter id="arrow-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <AnimatePresence>
        {arrows.map((a, i) => <ArrowView key={a.key} a={a} index={i} />)}
        {/* El As: onda que late alrededor (barre todo el tablero) */}
        {wipers.map(w => (
          <motion.circle
            key={`wipe-${w.x}-${w.y}`}
            cx={w.x}
            cy={w.y}
            fill="none"
            stroke="var(--c-cyan)"
            strokeWidth={2}
            initial={{ r: 10, opacity: 0.9 }}
            animate={{ r: [10, 34], opacity: [0.9, 0] }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>
    </svg>
  );
};
