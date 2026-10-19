import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BoardSlot, Card as CardType, CombatResult, GamePhase, Owner } from '@/types';
import { BoardGeometry } from '@/theme/layout';
import { CARD_SIZE } from '@/theme/tokens';
import { getTargetIndices, RANKS } from '@/lib/game-utils';
import { useStage } from '@/components/pixel/Stage';

// --- FLECHAS DE ATAQUE ---
// Cada carta dibuja una flecha animada hacia cada hueco que golpeará:
//  · Tus cartas: doradas (durante la colocación y la pelea; también la vista previa).
//  · Cartas del rival: rojas, SOLO cuando están destapadas (al empezar la pelea).
//  · Príncipe (objetivo aleatorio): flechas tenues en cian, "puede ir a cualquiera".
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

const COLOR: Record<Owner, string> = { player: 'var(--c-gold)', opponent: 'var(--c-mult)' };

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
      const side = Math.sign(t - index);
      // Sale del borde de la carta que mira al rival; las diagonales, un poco desplazadas
      const from = { x: p.x + CARD_SIZE.width / 2 + side * 9, y: owner === 'player' ? p.y + 2 : p.y + CARD_SIZE.height - 2 };
      // Llega al borde cercano de la carta objetivo, o al centro si el hueco está vacío
      const to = targetCard
        ? { x: q.x + CARD_SIZE.width / 2 - side * 6, y: owner === 'player' ? q.y + CARD_SIZE.height - 4 : q.y + 4 }
        : { x: q.x + CARD_SIZE.width / 2, y: q.y + CARD_SIZE.height / 2 };

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

/** Curva suave (las diagonales se arquean) y punta orientada según la tangente final */
const geometry = (a: Arrow) => {
  const mx = (a.from.x + a.to.x) / 2;
  const my = (a.from.y + a.to.y) / 2;
  const dx = a.to.x - a.from.x;
  const dy = a.to.y - a.from.y;
  const len = Math.hypot(dx, dy) || 1;
  const bend = Math.abs(dx) > 4 ? 10 : 0;
  const cx = mx + (-dy / len) * bend * Math.sign(dx);
  const cy = my + (dx / len) * bend * Math.sign(dx);
  const tx = a.to.x - cx;
  const ty = a.to.y - cy;
  const tl = Math.hypot(tx, ty) || 1;
  const ux = tx / tl;
  const uy = ty / tl;
  const head = 6;
  const base = { x: a.to.x - ux * head, y: a.to.y - uy * head };
  const left = { x: base.x - uy * 4, y: base.y + ux * 4 };
  const right = { x: base.x + uy * 4, y: base.y - ux * 4 };
  return {
    // La línea termina en la base de la punta para que no la atraviese
    d: `M ${a.from.x} ${a.from.y} Q ${cx} ${cy} ${base.x} ${base.y}`,
    head: `${a.to.x},${a.to.y} ${left.x},${left.y} ${right.x},${right.y}`,
  };
};

const ArrowView = ({ a, index }: { a: Arrow; index: number }) => {
  const { d, head } = geometry(a);
  const color = a.maybe ? 'var(--c-cyan)' : COLOR[a.owner];
  const opacity = a.effective === false ? 0.22 : a.preview ? 0.7 : a.maybe ? 0.75 : 1;
  const strong = a.effective === true;
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      style={strong ? { filter: `drop-shadow(0 0 2px ${color})` } : undefined}
    >
      {/* Contorno oscuro para que se lea sobre cualquier fondo */}
      <path d={d} fill="none" stroke="var(--c-outline)" strokeWidth={strong ? 5.5 : 4.5} strokeLinecap="round" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strong ? 3 : 2.2}
        strokeLinecap="round"
        strokeDasharray={a.maybe ? '2 4' : '5 4'}
        className="arrow-march"
      />
      <polygon points={head} fill={color} stroke="var(--c-outline)" strokeWidth={1.2} strokeLinejoin="round" />
    </motion.g>
  );
};

export const AttackArrows = (props: AttackArrowsProps) => {
  const { width, height } = useStage();
  const { arrows, wipers } = useMemo(() => buildArrows(props), [props]);

  return (
    <svg className="absolute left-0 top-0 pointer-events-none z-[12]" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
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
