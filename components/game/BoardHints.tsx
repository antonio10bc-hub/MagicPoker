import { ReactNode, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BoardSlot, Card as CardType, CombatResult, GamePhase } from '@/types';
import { BoardGeometry } from '@/theme/layout';
import { CARD_SIZE, INK } from '@/theme/tokens';
import { calculateCombat } from '@/lib/game-utils';
import { PixelSprite, Sprite } from '@/components/pixel/PixelSprite';
import { ALERT, CHECK, CROSS, HEART_LOST } from '@/components/pixel/sprites';
import { useArrowsVisible } from './AttackArrows';
import { aimAtOpponent, threatsFrom } from './forecast';

// --- AVISOS DEL TABLERO ---
// Ayudas visuales que se calculan SOLO con información visible (sin mirar las cartas
// boca abajo del rival) y con las mismas reglas de lib/game-utils (solo lectura):
//  · Tus huecos vacíos muestran un corazón tenue: si los golpean, pierdes una vida.
//    Si una carta rival lo amenaza (ver threatsFrom), el aviso se vuelve un "!" que late.
//  · Los huecos rivales vacíos a los que apuntan tus cartas muestran "-N" dorado (daño
//    seguro, sumado si varias coinciden). Las flechas las dibuja AttackArrows.
//  · Al destaparse todo, justo antes del golpe: ✓ en las cartas rivales que vas a
//    destruir y ✗ en las tuyas que van a caer.

interface BoardHintsProps {
  geo: BoardGeometry;
  playerBoard: BoardSlot[];
  opponentBoard: BoardSlot[];
  phase: GamePhase;
  combat: CombatResult | null;
  /** Carta seleccionada y hueco sobre el que está el puntero (vista previa) */
  preview: { card: CardType; slotIndex: number } | null;
  /** Cartas con las flechas encendidas: solo ellas marcan "-N" */
  shown: ReadonlySet<string>;
}

const Badge = ({ x, y, bg, children, pulse }: { x: number; y: number; bg: string; children: ReactNode; pulse?: boolean }) => (
  <motion.div
    // Masa de luz con la marca en silueta oscura
    className="absolute flex items-center justify-center pointer-events-none z-[25] text-ink font-display bloom"
    style={{ left: x, top: y, minWidth: 13, height: 13, padding: '2px 2px 0', borderRadius: 7, background: bg }}
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    exit={{ scale: 0, transition: { duration: 0.15 } }}
    transition={{ type: 'spring', stiffness: 500, damping: 18 }}
  >
    {/* Latido en CSS (compositor) */}
    <span className={pulse ? 'anim-throb flex items-center justify-center' : 'flex items-center justify-center'}>{children}</span>
  </motion.div>
);

const SpriteBadge = ({ sprite, ...rest }: { sprite: Sprite; x: number; y: number; bg: string; pulse?: boolean }) => (
  <Badge {...rest}><PixelSprite sprite={sprite} tint={INK.black} /></Badge>
);

export const BoardHints = ({ geo, playerBoard, opponentBoard, phase, combat, preview, shown }: BoardHintsProps) => {
  const placement = phase === 'placement';
  const opponentRevealed = opponentBoard.some(s => s.card?.isFaceUp);

  const aims = useMemo(() => aimAtOpponent(playerBoard, preview, shown), [playerBoard, preview, shown]);
  const threats = useMemo(() => threatsFrom(opponentBoard), [opponentBoard]);

  // Predicción justo antes del golpe (cartas ya destapadas, resultado aún no llegado).
  // El Príncipe elige al azar: se usa su objetivo central solo para avisar.
  // Con el resultado ya publicado se usa el real mientras las flechas siguen visibles
  const arrowsVisible = useArrowsVisible(combat);
  const prediction = useMemo(
    () => (phase === 'combat' && opponentRevealed && !combat ? calculateCombat(playerBoard, opponentBoard, () => 0.5)
      : combat && arrowsVisible ? combat : null),
    [phase, opponentRevealed, combat, arrowsVisible, playerBoard, opponentBoard]
  );

  const badgeAt = (p: { x: number; y: number }) => ({ x: p.x + CARD_SIZE.width - 10, y: p.y - 5 });

  return (
    <AnimatePresence>
      {/* Tus huecos vacíos: vida expuesta / amenazada */}
      {placement && playerBoard.map(slot => {
        if (slot.card) return null;
        const p = geo.slots.player[slot.index];
        const threatened = threats[slot.index];
        return (
          <motion.div key={`life-${slot.index}`} className="absolute pointer-events-none z-[15]"
            style={{ left: p.x, top: p.y, width: CARD_SIZE.width, height: CARD_SIZE.height }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
            {threatened && (
              <div className="absolute inset-0 rounded-[3px] anim-pulse"
                style={{ background: 'radial-gradient(ellipse at 50% 60%, rgba(255,74,28,0.35), rgba(255,74,28,0.08) 70%)', boxShadow: '0 0 6px 1px rgba(255,74,28,0.35)' }} />
            )}
            <div className="absolute" style={{ left: 15, top: CARD_SIZE.height - 14, opacity: threatened ? 0.9 : 0.45 }}>
              <PixelSprite sprite={HEART_LOST} tint={threatened ? INK.orange : INK.mint} />
            </div>
          </motion.div>
        );
      })}
      {placement && playerBoard.map(slot => {
        if (slot.card || !threats[slot.index]) return null;
        const b = badgeAt(geo.slots.player[slot.index]);
        return <SpriteBadge key={`threat-${slot.index}`} sprite={ALERT} x={b.x + 2} y={b.y} bg="var(--c-mult)" pulse />;
      })}

      {/* Tus objetivos en la fila rival */}
      {placement && aims.map((aim, i) => {
        const hits = aim.sure + aim.maybe;
        if (!hits && !aim.wipe) return null;
        const p = geo.slots.opponent[i];
        const b = badgeAt(p);
        const occupied = !!opponentBoard[i].card;
        const faded = aim.previewOnly ? 0.75 : 1;
        // Las flechas (AttackArrows) ya señalan cartas y el barrido del As;
        // aquí solo queda el daño seguro en huecos vacíos
        if (aim.wipe || occupied) return null;
        return (
          <Badge key={`aim-${i}`} x={b.x - 2} y={p.y + CARD_SIZE.height / 2 - 6} bg="var(--c-gold)" pulse>
            <span style={{ opacity: faded }}>{aim.sure > 0 ? `-${aim.sure}${aim.maybe > 0 ? '+' : ''}` : '-?'}</span>
          </Badge>
        );
      })}

      {/* Justo antes del golpe: quién cae */}
      {prediction && [...playerBoard, ...opponentBoard].map(slot => {
        if (!slot.card || !prediction.deadCardIds.includes(slot.card.id)) return null;
        const owner = slot.card.owner;
        const b = badgeAt(geo.slots[owner][slot.index]);
        return owner === 'opponent'
          ? <SpriteBadge key={`win-${slot.card.id}`} sprite={CHECK} x={b.x} y={b.y} bg="var(--ink-cream)" />
          : <SpriteBadge key={`lose-${slot.card.id}`} sprite={CROSS} x={b.x} y={b.y} bg="var(--c-mult)" />;
      })}
    </AnimatePresence>
  );
};
