import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/store/useGameStore';
import { BoardSlot, Owner } from '@/types';
import { useGameLayout } from '@/components/pixel/Stage';
import { CARD_SIZE, SNAP_EASE, steps } from '@/theme/tokens';
import { useTranslations } from '@/lib/i18n';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { BURST, ICONS } from '@/components/pixel/sprites';
import { Card } from './Card';

/** Losa encastrada en el suelo: sombra interior arriba-izquierda, brillo abajo-derecha */
const SlotTile = ({ x, y, highlight }: { x: number; y: number; highlight: boolean }) => (
  <div
    className={clsx('absolute px-round', highlight && 'anim-pulse-outline')}
    style={{
      left: x - 1, top: y - 1, width: CARD_SIZE.width + 2, height: CARD_SIZE.height + 2,
      background: highlight ? 'var(--c-cyan)' : 'var(--c-floor-pattern)',
      boxShadow: 'inset 0 0 0 1px var(--c-outline), inset 1px 1px 0 1px var(--c-stone-dark), inset -1px -1px 0 1px var(--c-white)',
    }}
  />
);

/** Estallido "-N" sobre un hueco vacío que recibe daño directo */
const DamageBurst = ({ amount, x, y }: { amount: number; x: number; y: number }) => (
  <motion.div
    initial={{ scale: 0.4, opacity: 0 }}
    animate={{ scale: [0.4, 1.4, 1], opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2, ease: steps(3) }}
    className="absolute z-40 pointer-events-none flex items-center justify-center"
    style={{ left: x + 4, top: y + 12, width: 32, height: 32 }}
  >
    <PixelSprite sprite={BURST} scale={2} style={{ position: 'absolute', left: 3, top: 3 }} />
    <span className="relative text-title text-outline" style={{ color: 'var(--c-red)' }}>-{amount}</span>
  </motion.div>
);

/** Carta en mesa con su sombra; al aparecer hace un arco corto y rebota al aterrizar */
const PlacedCard = ({ slot, owner, x, y }: { slot: BoardSlot; owner: Owner; x: number; y: number }) => {
  const from = owner === 'player' ? 40 : -40;
  return (
    <>
      <motion.div
        className="absolute"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: steps(4) }}
        style={{ left: x + 2, top: y + 3, width: CARD_SIZE.width, height: CARD_SIZE.height, background: 'var(--c-shadow)' }}
      />
      <motion.div
        className="absolute z-10"
        style={{ left: x, top: y }}
        initial={{ y: from, opacity: 0 }}
        animate={{ y: [from, from / 2 - 8, -3, 0, -1, 0], opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.1, ease: steps(2) } }}
        transition={{ duration: 0.25, ease: 'linear' }}
      >
        <Card card={slot.card!} />
      </motion.div>
    </>
  );
};

interface BoardProps {
  selectedCardId: string | null;
  onSlotClick: (slotIndex: number) => void;
}

export const Board = ({ selectedCardId, onSlotClick }: BoardProps) => {
  const t = useTranslations();
  const { board: geo } = useGameLayout();
  const { playerBoard, opponentBoard, combat, isPlacementPhase, isFighting } = useGameStore(useShallow(s => ({
    playerBoard: s.player.board,
    opponentBoard: s.opponent.board,
    combat: s.pendingCombatResult,
    isPlacementPhase: s.phase === 'placement',
    isFighting: s.phase === 'combat' || s.phase === 'combat-reveal',
  })));

  const isTargeting = !!selectedCardId && isPlacementPhase;

  const renderSide = (board: BoardSlot[], owner: Owner) => {
    const hits = owner === 'player' ? combat?.playerEmptySlotsHit : combat?.opponentEmptySlotsHit;
    return board.map(slot => {
      const { x, y } = geo.slots[owner][slot.index];
      const canTarget = owner === 'player' && !slot.card && isTargeting;
      return (
        <div key={`${owner}-${slot.index}`}>
          <SlotTile x={x} y={y} highlight={canTarget} />
          {canTarget && (
            <button
              aria-label={`slot ${slot.index + 1}`}
              onClick={() => onSlotClick(slot.index)}
              className="absolute z-20 flex items-center justify-center cursor-pointer"
              style={{ left: x, top: y, width: CARD_SIZE.width, height: CARD_SIZE.height }}
            >
              <span className="anim-bob"><PixelSprite sprite={ICONS.cursor} scale={2} /></span>
            </button>
          )}
          <AnimatePresence>
            {slot.card && <PlacedCard key={slot.card.id} slot={slot} owner={owner} x={x} y={y} />}
          </AnimatePresence>
          <AnimatePresence>
            {hits?.[slot.index] !== undefined && <DamageBurst amount={hits[slot.index]} x={x} y={y} />}
          </AnimatePresence>
        </div>
      );
    });
  };

  const c = geo.centerLine;
  return (
    <>
      {renderSide(opponentBoard, 'opponent')}
      {renderSide(playerBoard, 'player')}

      {/* Cinta "¡PELEA!" sobre la franja central */}
      <AnimatePresence>
        {isFighting && (
          <motion.div
            className="absolute z-30 flex items-center justify-center text-title text-outline pointer-events-none"
            style={{ left: c.x, top: c.y - 4, width: c.w, height: c.h + 8, background: 'var(--c-yellow)', color: 'var(--c-white)',
              boxShadow: 'inset 0 0 0 1px var(--c-outline), inset 0 2px 0 0 #FFF0A0, inset 0 -2px 0 0 var(--c-yellow-dark)' }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleY: 0, transition: { duration: 0.1, ease: steps(2) } }}
            transition={{ duration: 0.15, ease: SNAP_EASE }}
          >
            <span style={{ color: 'var(--c-red)' }}>{t.fight}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
