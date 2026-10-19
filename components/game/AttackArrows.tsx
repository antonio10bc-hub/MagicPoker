import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BoardSlot, Card as CardType, CombatResult, GamePhase, Owner } from '@/types';
import { BoardGeometry } from '@/theme/layout';
import { CARD_SIZE, TEAM } from '@/theme/tokens';
import { getTargetIndices, RANKS } from '@/lib/game-utils';
import { useStage } from '@/components/pixel/Stage';
import { ARROW_HOLD_S } from './Card';

// --- FLECHAS DE ATAQUE ---
// Cada carta dibuja una flecha hacia cada hueco que golpeará, del color de su bando
// (verde tú, rojo el rival). Forma de cuña: fina al salir y ancha en la punta, con un
// leve arco; translúcida para no tapar el tablero.
//
// Lectura de la pelea:
//  · Dos cartas que se atacan de frente: si una gana, solo queda su flecha; si
//    empatan, las dos se quedan a mitad de camino y chocan con un destello.
//  · Varias flechas al mismo hueco abren sus puntas en abanico.
//  · Cada flecha se curva siempre hacia su derecha: dos flechas que se cruzan dibujan
//    una "X" clara en lugar de solaparse.
//  · El rival solo muestra flechas con las cartas destapadas. Al resolverse la pelea
//    se ven ARROW_HOLD_S segundos y desaparecen: las cartas embisten sin ruido.
//  · Príncipe (objetivo aleatorio): flechas más tenues y discontinuas.
//  · El As no dibuja flechas: una onda alrededor indica que barre todo el tablero.
// Solo lee el estado y las reglas (lib/game-utils); no cambia nada de la partida.

interface Arrow {
  key: string;
  owner: Owner;
  from: { x: number; y: number };
  to: { x: number; y: number };
  maybe: boolean;
  preview: boolean;
  /** Empate de frente: la flecha se queda a mitad de camino */
  clash: boolean;
}

interface AttackArrowsProps {
  geo: BoardGeometry;
  playerBoard: BoardSlot[];
  opponentBoard: BoardSlot[];
  phase: GamePhase;
  combat: CombatResult | null;
  preview: { card: CardType; slotIndex: number } | null;
}

/** ¿Siguen visibles las flechas? Hasta ARROW_HOLD_S después de resolverse la pelea */
export const useArrowsVisible = (combat: CombatResult | null) => {
  const [expired, setExpired] = useState<CombatResult | null>(null);
  useEffect(() => {
    if (!combat) return;
    const t = setTimeout(() => setExpired(combat), ARROW_HOLD_S * 1000);
    return () => clearTimeout(t);
  }, [combat]);
  return !combat || expired !== combat;
};

interface Attack { card: CardType; index: number; owner: Owner; target: number; maybe: boolean; preview: boolean }

const buildArrows = ({ geo, playerBoard, opponentBoard, phase, preview }: AttackArrowsProps) => {
  const wipers: { x: number; y: number; owner: Owner }[] = [];
  const attacks: Attack[] = [];
  if (phase !== 'placement' && phase !== 'combat' && phase !== 'combat-reveal') return { arrows: [], wipers, clashes: [] };

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
    getTargetIndices(index, card.rank).forEach(target =>
      attacks.push({ card, index, owner, target, maybe: def.attack!.mode === 'random-one', preview: isPreview }));
  });

  // Enfrentamientos de frente: A ataca el hueco de B y B ataca el de A
  const hidden = new Set<Attack>();
  const clashing = new Set<Attack>();
  attacks.forEach(a => {
    const rival = attacks.find(b => b.owner !== a.owner && b.index === a.target && b.target === a.index && !b.maybe && !a.maybe);
    if (!rival) return;
    if (a.card.value < rival.card.value) hidden.add(a);
    else if (a.card.value === rival.card.value) clashing.add(a);
  });

  // Varias flechas al mismo hueco: abrimos las puntas en abanico
  const visible = attacks.filter(a => !hidden.has(a));
  const byTarget = new Map<string, Attack[]>();
  visible.forEach(a => {
    const k = `${a.owner}-${a.target}`;
    byTarget.set(k, [...(byTarget.get(k) ?? []), a]);
  });

  const clashes: { x: number; y: number }[] = [];
  const arrows: Arrow[] = visible.map(a => {
    const enemy: Owner = a.owner === 'player' ? 'opponent' : 'player';
    const p = geo.slots[a.owner][a.index];
    const q = geo.slots[enemy][a.target];
    const group = byTarget.get(`${a.owner}-${a.target}`)!.sort((m, n) => m.index - n.index);
    const spread = group.length > 1 ? (group.indexOf(a) - (group.length - 1) / 2) * 9 : 0;
    const from = { x: p.x + CARD_SIZE.width / 2, y: a.owner === 'player' ? p.y + 14 : p.y + CARD_SIZE.height - 14 };
    let to = { x: q.x + CARD_SIZE.width / 2 + spread, y: q.y + CARD_SIZE.height / 2 };
    const clash = clashing.has(a);
    if (clash) {
      to = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 + (a.owner === 'player' ? 4 : -4) };
      if (a.owner === 'player') clashes.push({ x: to.x, y: to.y - 4 });
    }
    return { key: `${a.card.id}-${a.target}`, owner: a.owner, from, to, maybe: a.maybe, preview: a.preview, clash };
  });
  return { arrows, wipers, clashes };
};

/**
 * Cuña con arco: curva cuadrática que siempre se dobla a la derecha de su dirección,
 * con grosor creciente (2 → 10 px) y una punta ancha al final.
 */
const wedge = (a: Arrow) => {
  const dx = a.to.x - a.from.x;
  const dy = a.to.y - a.from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len; // normal (derecha de la dirección)
  const ny = dx / len;
  const bend = Math.min(10, len * 0.18);
  const c = { x: (a.from.x + a.to.x) / 2 + nx * bend, y: (a.from.y + a.to.y) / 2 + ny * bend };
  const head = Math.min(13, len * 0.42);

  // Punto y tangente de la curva en t
  const at = (t: number) => {
    const u = 1 - t;
    return {
      x: u * u * a.from.x + 2 * u * t * c.x + t * t * a.to.x,
      y: u * u * a.from.y + 2 * u * t * c.y + t * t * a.to.y,
      tx: 2 * u * (c.x - a.from.x) + 2 * t * (a.to.x - c.x),
      ty: 2 * u * (c.y - a.from.y) + 2 * t * (a.to.y - c.y),
    };
  };
  // La punta empieza donde quedan `head` px hasta el final (aprox. por longitud)
  const tHead = Math.max(0.5, 1 - head / len);
  const left: string[] = [];
  const right: string[] = [];
  const STEPS = 10;
  for (let i = 0; i <= STEPS; i++) {
    const t = (i / STEPS) * tHead;
    const pt = at(t);
    const tl = Math.hypot(pt.tx, pt.ty) || 1;
    const w = 1 + 3.8 * (t / tHead); // medio grosor: fino → ancho
    left.push(`${pt.x + (-pt.ty / tl) * w},${pt.y + (pt.tx / tl) * w}`);
    right.unshift(`${pt.x - (-pt.ty / tl) * w},${pt.y - (pt.tx / tl) * w}`);
  }
  const base = at(tHead);
  const bl = Math.hypot(base.tx, base.ty) || 1;
  const hw = 9; // medio ancho de la punta
  const headL = `${base.x + (-base.ty / bl) * hw},${base.y + (base.tx / bl) * hw}`;
  const headR = `${base.x - (-base.ty / bl) * hw},${base.y - (base.tx / bl) * hw}`;
  return `M ${left.join(' L ')} L ${headL} L ${a.to.x},${a.to.y} L ${headR} L ${right.join(' L ')} Z`;
};

const ArrowView = ({ a, index }: { a: Arrow; index: number }) => {
  const team = TEAM[a.owner];
  const d = wedge(a);
  const gradId = `arrow-grad-${a.key}`;
  const peak = a.preview ? 0.5 : a.maybe ? 0.45 : 0.72;
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: [peak * 0.8, peak, peak * 0.8] }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: index * 0.05 }}
    >
      <defs>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={a.from.x} y1={a.from.y} x2={a.to.x} y2={a.to.y}>
          <stop offset="0" stopColor={team.light} stopOpacity={0.2} />
          <stop offset="0.6" stopColor={team.light} stopOpacity={0.65} />
          <stop offset="1" stopColor={team.light} stopOpacity={1} />
        </linearGradient>
      </defs>
      {/* Halo suave del color del bando */}
      <path d={d} fill={team.base} opacity={0.35} filter="url(#arrow-glow)" />
      {/* Cuerpo translúcido con borde fino del tono oscuro del bando */}
      <path d={d} fill={`url(#${gradId})`} stroke={team.dark} strokeOpacity={0.6} strokeWidth={0.8} strokeLinejoin="round"
        strokeDasharray={a.maybe ? '3 3' : undefined} />
    </motion.g>
  );
};

export const AttackArrows = (props: AttackArrowsProps) => {
  const { width, height } = useStage();
  const visible = useArrowsVisible(props.combat);
  const { arrows, wipers, clashes } = useMemo(() => buildArrows(props), [props]);

  return (
    <svg className="absolute left-0 top-0 pointer-events-none z-[12]" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        <filter id="arrow-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      <AnimatePresence>
        {visible && arrows.map((a, i) => <ArrowView key={a.key} a={a} index={i} />)}
        {/* Empate de frente: destello donde chocan las dos flechas */}
        {visible && clashes.map(c => (
          <motion.g key={`clash-${c.x}-${c.y}`} initial={{ scale: 0, opacity: 0 }} animate={{ scale: [1, 1.25, 1], opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }} transition={{ duration: 0.8, repeat: Infinity }}
            style={{ transformOrigin: `${c.x}px ${c.y}px` }}>
            <path d={`M ${c.x} ${c.y - 6} L ${c.x + 2} ${c.y - 2} L ${c.x + 6} ${c.y} L ${c.x + 2} ${c.y + 2} L ${c.x} ${c.y + 6} L ${c.x - 2} ${c.y + 2} L ${c.x - 6} ${c.y} L ${c.x - 2} ${c.y - 2} Z`}
              fill="var(--c-yellow)" stroke="var(--c-outline)" strokeWidth={0.8} />
          </motion.g>
        ))}
        {/* El As: onda que late alrededor (barre todo el tablero) */}
        {visible && wipers.map(w => (
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
