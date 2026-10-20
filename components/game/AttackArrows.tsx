import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BoardSlot, Card as CardType, CombatResult, GamePhase, Owner } from '@/types';
import { BoardGeometry } from '@/theme/layout';
import { CARD_SIZE, TEAM } from '@/theme/tokens';
import { Attack, collectAttacks, facingOutcomes } from './forecast';
import { useStage } from '@/components/pixel/Stage';
import { ARROW_HOLD_S } from './Card';
import { gameTimeout } from '@/lib/clock';

// --- FLECHAS DE ATAQUE ---
// Cada carta dibuja una flecha hacia cada hueco que golpeará, del color de su bando
// (verde tú, rojo el rival). Forma de cuña: fina al salir y ancha en la punta, con un
// leve arco; translúcida para no tapar el tablero.
//
// Las flechas se encienden y apagan tocando cartas de la mesa (tuyas o rivales
// destapadas), una o varias a la vez; además se ve la de la carta que estás colocando.
//
// Lectura de la pelea:
//  · Dos cartas que se atacan de frente: la flecha de la que pierde se queda muy
//    pequeña y fina (se ve que compiten, pero quién gana); si empatan, las dos se
//    quedan a mitad de camino y chocan con un destello.
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
  /** Pierde un enfrentamiento de frente: flecha muy pequeña y fina */
  losing: boolean;
}

interface AttackArrowsProps {
  geo: BoardGeometry;
  playerBoard: BoardSlot[];
  opponentBoard: BoardSlot[];
  phase: GamePhase;
  combat: CombatResult | null;
  preview: { card: CardType; slotIndex: number } | null;
  /** Cartas de la mesa con las flechas encendidas (tocar una carta las enciende/apaga) */
  shown: ReadonlySet<string>;
}

/** ¿Siguen visibles las flechas? Hasta ARROW_HOLD_S después de resolverse la pelea */
export const useArrowsVisible = (combat: CombatResult | null) => {
  const [expired, setExpired] = useState<CombatResult | null>(null);
  useEffect(() => {
    if (!combat) return;
    const cancel = gameTimeout(() => setExpired(combat), ARROW_HOLD_S * 1000);
    return cancel;
  }, [combat]);
  return !combat || expired !== combat;
};

const buildArrows = ({ geo, playerBoard, opponentBoard, phase, preview, shown }: AttackArrowsProps) => {
  if (phase !== 'placement' && phase !== 'combat' && phase !== 'combat-reveal') return { arrows: [], wipers: [], clashes: [] };
  const center = (owner: Owner, index: number) => {
    const p = geo.slots[owner][index];
    return { x: p.x + CARD_SIZE.width / 2, y: p.y + CARD_SIZE.height / 2 };
  };

  const known = collectAttacks(playerBoard, opponentBoard, phase === 'placement' ? preview : null);
  const attacks = known.attacks;
  const wipers = known.wipers.map(w => ({ ...center(w.owner, w.index), owner: w.owner }));
  // Enfrentamientos calculados con todas las cartas conocidas aunque solo se dibujen las
  // encendidas: así la flecha de una carta que pierde sale pequeñita aunque la
  // ganadora no esté encendida.
  const { losing, clashing } = facingOutcomes(attacks);

  // Solo se dibujan las cartas encendidas (y la vista previa al apuntar/arrastrar)
  const visible = attacks.filter(a => a.preview || shown.has(a.card.id));
  // Varias flechas al mismo hueco: abrimos las puntas en abanico
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
    const isLosing = losing.has(a);
    if (clash) {
      to = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 + (a.owner === 'player' ? 4 : -4) };
      clashes.push({ x: to.x, y: to.y + (a.owner === 'player' ? -4 : 4) });
    } else if (isLosing) {
      // Se queda corta frente a la ganadora: se ve que compiten, pero quién gana
      to = { x: from.x + (to.x - from.x) * 0.38, y: from.y + (to.y - from.y) * 0.38 };
    }
    return { key: `${a.card.id}-${a.target}`, owner: a.owner, from, to, maybe: a.maybe, preview: a.preview, clash, losing: isLosing };
  });
  const seen = new Set<string>();
  return { arrows, wipers, clashes: clashes.filter(c => { const k = `${Math.round(c.x)}-${Math.round(c.y / 8)}`; if (seen.has(k)) return false; seen.add(k); return true; }) };
};

/**
 * Cuña con arco: curva cuadrática que siempre se dobla a la derecha de su dirección,
 * con grosor creciente (2 → 10 px) y una punta ancha al final.
 */
const wedge = (a: Arrow) => {
  const k = a.losing ? 0.45 : 1; // las perdedoras, más finas
  const dx = a.to.x - a.from.x;
  const dy = a.to.y - a.from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len; // normal (derecha de la dirección)
  const ny = dx / len;
  const bend = Math.min(10, len * 0.18) * k;
  const c = { x: (a.from.x + a.to.x) / 2 + nx * bend, y: (a.from.y + a.to.y) / 2 + ny * bend };
  const head = Math.min(13 * k, len * 0.42);

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
    const w = (1 + 3.8 * (t / tHead)) * k; // medio grosor: fino → ancho
    left.push(`${pt.x + (-pt.ty / tl) * w},${pt.y + (pt.tx / tl) * w}`);
    right.unshift(`${pt.x - (-pt.ty / tl) * w},${pt.y - (pt.tx / tl) * w}`);
  }
  const base = at(tHead);
  const bl = Math.hypot(base.tx, base.ty) || 1;
  const hw = 9 * k; // medio ancho de la punta
  const headL = `${base.x + (-base.ty / bl) * hw},${base.y + (base.tx / bl) * hw}`;
  const headR = `${base.x - (-base.ty / bl) * hw},${base.y - (base.tx / bl) * hw}`;
  return `M ${left.join(' L ')} L ${headL} L ${a.to.x},${a.to.y} L ${headR} L ${right.join(' L ')} Z`;
};

const ArrowView = ({ a }: { a: Arrow }) => {
  const team = TEAM[a.owner];
  const d = wedge(a);
  const gradId = `arrow-grad-${a.key}`;
  const peak = a.preview ? 0.5 : a.losing ? 0.55 : a.maybe ? 0.45 : 0.75;
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: peak }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.25 }}
    >
      {/* Estática a propósito: cualquier cambio dentro del SVG obliga a recalcular los
          desenfoques de todas las flechas en cada fotograma */}
      <g>
      <defs>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={a.from.x} y1={a.from.y} x2={a.to.x} y2={a.to.y}>
          <stop offset="0" stopColor={team.light} stopOpacity={0.2} />
          <stop offset="0.6" stopColor={team.light} stopOpacity={0.65} />
          <stop offset="1" stopColor={team.light} stopOpacity={1} />
        </linearGradient>
      </defs>
      {/* Halo: luz del bando que se deshace (halación rojiza en ambos) */}
      <path d={d} fill={team.light} opacity={0.5} filter="url(#arrow-glow)" />
      <path d={d} fill="#FF4A1C" opacity={a.owner === 'opponent' ? 0.45 : 0.12} filter="url(#arrow-halation)" />
      {/* Cuerpo luminoso, sin contorno; el Príncipe (al azar) va discontinuo */}
      <path d={d} fill={`url(#${gradId})`} stroke={a.maybe ? team.light : 'none'} strokeOpacity={0.8} strokeWidth={0.8} strokeLinejoin="round"
        strokeDasharray={a.maybe ? '3 3' : undefined} fillOpacity={a.maybe ? 0.5 : 1} />
      </g>
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
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
        <filter id="arrow-halation" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <AnimatePresence>
        {visible && arrows.map(a => <ArrowView key={a.key} a={a} />)}
        {/* Empate de frente: destello donde chocan las dos flechas */}
        {visible && clashes.map(c => (
          <motion.g key={`clash-${c.x}-${c.y}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            className="anim-throb" style={{ transformOrigin: `${c.x}px ${c.y}px`, transformBox: 'view-box' }}>
            <path d={`M ${c.x} ${c.y - 6} L ${c.x + 2} ${c.y - 2} L ${c.x + 6} ${c.y} L ${c.x + 2} ${c.y + 2} L ${c.x} ${c.y + 6} L ${c.x - 2} ${c.y + 2} L ${c.x - 6} ${c.y} L ${c.x - 2} ${c.y - 2} Z`}
              fill="#EDEBE0" style={{ filter: 'drop-shadow(0 0 3px #FF4A1C)' }} />
          </motion.g>
        ))}
        {/* El As: onda que late alrededor (barre todo el tablero) */}
        {visible && wipers.map(w => (
          <circle
            key={`wipe-${w.x}-${w.y}`}
            className="anim-ring"
            cx={w.x}
            cy={w.y}
            r={10}
            fill="none"
            stroke="#EDEBE0"
            strokeWidth={2}
            style={{ filter: 'drop-shadow(0 0 2px #FF4A1C)' }}
          />
        ))}
      </AnimatePresence>
    </svg>
  );
};
