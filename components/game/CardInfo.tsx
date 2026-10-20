import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { useTranslations, Translations } from '@/lib/i18n';
import { Rank } from '@/types';
import { RANKS } from '@/lib/game-utils';
import { useGameLayout, useStage } from '@/components/pixel/Stage';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { INK } from '@/theme/tokens';
import { CHARACTERS, SEAL_ICONS } from '@/components/pixel/sprites';

// --- FICHA DE CARTA ---
// Al mantener pulsada una carta de la mano (o dejar el ratón encima) aparece una ficha
// encima de la mano con lo que hace: valor, a qué huecos ataca y su habilidad.

const SPECIAL_TEXT: Partial<Record<Rank, keyof Translations>> = {
  A: 'special_ace', K: 'special_king', Q: 'special_queen', J: 'special_jack', JOKER: 'special_joker',
  // Cartas del Castillo
  JESTER: 'idea_jester_desc', TOWER: 'idea_tower_desc', BOMB: 'idea_bomb_desc', SPY: 'idea_spy_desc',
  KNIGHT: 'idea_knight_desc', PRIESTESS: 'idea_priestess_desc',
};

/** Mini diagrama: 3 casillas (izquierda, frente, derecha) y las que golpea */
const AttackDiagram = ({ rank }: { rank: Rank }) => {
  const attack = RANKS[rank].attack;
  if (!attack) return null;
  return (
    <div className="flex gap-[2px]">
      {[-1, 0, 1].map(o => (
        <span key={o} style={{
          width: 6, height: 6, borderRadius: 1,
          background: attack.offsets.includes(o) ? (attack.mode === 'random-one' ? 'var(--ink-mint)' : 'var(--ink-ember)') : 'var(--ink-slate)',
        }} />
      ))}
    </div>
  );
};

export const CardInfo = ({ cardId }: { cardId: string | null }) => {
  const t = useTranslations();
  const card = useGameStore(s => s.player.hand.find(c => c.id === cardId) ?? null);
  const { hand } = useGameLayout();
  const { width } = useStage();
  const w = Math.min(176, width - 8);

  return (
    <AnimatePresence>
      {card?.rank === 'SEAL' && (
        // Carta de sello: icono verde, nombre, qué hace y cómo se juega
        <motion.div
          key={card.id}
          className="absolute z-[95] px-panel px-round pointer-events-none flex gap-[6px] p-[5px]"
          style={{ left: Math.round(hand.x + hand.w / 2 - w / 2), top: hand.y - 62, width: w, boxShadow: '0 0 0 1px rgba(125,255,43,0.5)' }}
          initial={{ y: 10, scale: 0.8, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 6, scale: 0.9, opacity: 0, transition: { duration: 0.12 } }}
          transition={{ type: 'spring', stiffness: 500, damping: 24 }}
        >
          {card.seal ? <PixelSprite sprite={SEAL_ICONS[card.seal]} tint={INK.volt} scale={2} className="shrink-0 bloom-volt-shape" />
            : <span className="shrink-0 font-display glow-volt" style={{ color: 'var(--ink-volt)', fontSize: 20 }}>?</span>}
          <div className="flex flex-col gap-[3px] leading-[11px] min-w-0">
            <span className="glow-volt" style={{ color: 'var(--ink-volt)' }}>{card.seal ? t[`seal_${card.seal}` as keyof Translations] : t.idea_wild_seal}</span>
            <span className="whitespace-normal">{card.seal ? t[`seal_${card.seal}_desc` as keyof Translations] : t.idea_wild_seal_desc}</span>
            <span style={{ color: 'var(--ink-teal)' }}>{t.seal_apply_hint}</span>
          </div>
        </motion.div>
      )}
      {card && card.rank !== 'SEAL' && (
        <motion.div
          key={card.id}
          className="absolute z-[95] px-panel px-round pointer-events-none flex gap-[5px] p-[5px]"
          style={{ left: Math.round(hand.x + hand.w / 2 - w / 2), top: hand.y - 62, width: w }}
          initial={{ y: 10, scale: 0.8, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 6, scale: 0.9, opacity: 0, transition: { duration: 0.12 } }}
          transition={{ type: 'spring', stiffness: 500, damping: 24 }}
        >
          {CHARACTERS[card.rank] && <PixelSprite sprite={CHARACTERS[card.rank]!} tint={INK.cream} className="shrink-0 bloom-cream" />}
          <div className="flex flex-col gap-[3px] leading-[11px] min-w-0">
            <div className="flex items-center gap-[5px]">
              <span className="text-title text-outline glow-text" style={{ color: 'var(--ink-orange)' }}>{card.rank}</span>
              <span style={{ color: 'var(--c-ui-muted)' }}>{t.card_value} {card.value}</span>
              <AttackDiagram rank={card.rank} />
            </div>
            <span className="whitespace-normal">{t[SPECIAL_TEXT[card.rank] ?? 'card_number_desc']}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
