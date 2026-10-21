import { motion } from 'framer-motion';
import { Rank } from '@/types';
import { Boon, CardTemplate, chooseBoon, getCastle } from '@/lib/castle';
import { Translations, useTranslations } from '@/lib/i18n';
import { playSfx, playSound } from '@/lib/sounds';
import { INK } from '@/theme/tokens';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { CHARACTERS, HEART, SEAL_ICONS, STAR } from '@/components/pixel/sprites';
import { useGameStore } from '@/store/useGameStore';

// --- MEJORAS DEL CASTILLO (el género del mercader) ---
// Tras vencer a un jefe del Castillo el mercader te ofrece 3 mejoras; eliges 1 y sube
// el siguiente. Todo lo que sale de él va en azul eléctrico.

const CASTLE_NAMES: Partial<Record<Rank, keyof Translations>> = {
  JESTER: 'idea_jester', TOWER: 'idea_tower', BOMB: 'idea_bomb', SPY: 'idea_spy', KNIGHT: 'idea_knight', PRIESTESS: 'idea_priestess',
};

/** Nombre de una carta para los textos de las mejoras */
export const cardName = (t: Translations, c: CardTemplate | { rank: Rank | 'WILD' }): string => {
  if (c.rank === 'WILD' || ('wild' in c && c.wild)) return t.idea_wild_seal;
  if (c.rank === 'SEAL' && 'seal' in c && c.seal) return t[`seal_${c.seal}` as keyof Translations];
  const castle = CASTLE_NAMES[c.rank as Rank];
  const base = castle ? t[castle] : c.rank === 'JOKER' ? 'Joker' : c.rank;
  return 'bonus' in c && c.bonus ? `${base} (+${c.bonus})` : base;
};

const boonText = (t: Translations, boon: Boon, deck: CardTemplate[]): { title: string; desc: string } => {
  const title = t[`boon_${boon.kind}` as keyof Translations];
  switch (boon.kind) {
    case 'card': return { title, desc: t.boon_card_desc.replace('{card}', cardName(t, boon)) };
    case 'seal': return { title, desc: t.boon_seal_desc.replace('{card}', cardName(t, deck[boon.target])).replace('{seal}', t[`seal_${boon.seal}` as keyof Translations]) };
    case 'upgrade': return { title, desc: t.boon_upgrade_desc.replace('{card}', cardName(t, deck[boon.target])) };
    case 'purge': return { title, desc: t.boon_purge_desc.replace('{cards}', boon.targets.map(i => cardName(t, deck[i])).join(' + ')) };
    default: return { title, desc: t[`boon_${boon.kind}_desc` as keyof Translations] };
  }
};

const BoonIcon = ({ boon }: { boon: Boon }) => {
  const shape = { tint: INK.azure, className: 'bloom-azure-shape' };
  if (boon.kind === 'heal' || boon.kind === 'maxLife') return <PixelSprite sprite={HEART} {...shape} />;
  if (boon.kind === 'seal') return <PixelSprite sprite={SEAL_ICONS[boon.seal]} {...shape} />;
  if (boon.kind === 'card' && boon.rank !== 'WILD') return <PixelSprite sprite={CHARACTERS[boon.rank]!} {...shape} />;
  if (boon.kind === 'pact') return <PixelSprite sprite={STAR} {...shape} />;
  return <span className="font-display glow-azure" style={{ color: 'var(--ink-azure)', fontSize: 14 }}>{boon.kind === 'card' ? '?' : boon.kind === 'upgrade' ? '+2' : '−'}</span>;
};

/** Las 3 mejoras de la subida en curso. `onChosen` se llama tras elegir (por defecto, sube al siguiente jefe). */
export const BoonChooser = ({ onChosen, delay = 0.15 }: { onChosen?: () => void; delay?: number }) => {
  const t = useTranslations();
  const run = getCastle().run;
  if (!run?.offer) return null;
  const pick = (i: number) => {
    playSound('click');
    playSfx('sparkle');
    if (!chooseBoon(i)) return;
    if (onChosen) onChosen();
    else useGameStore.getState().startCastle();
  };
  return (
    <div className="flex flex-col gap-[4px] w-full">
      <span className="text-center glow-azure" style={{ color: 'var(--ink-azure)' }}>{t.castle_choose}</span>
      {run.offer.map((boon, i) => {
        const { title, desc } = boonText(t, boon, run.deck);
        return (
          <motion.button key={i} aria-label={`boon ${boon.kind}`} className="px-inset px-round flex items-center gap-[6px] p-[4px] text-left cursor-pointer"
            style={{ boxShadow: 'inset 0 0 0 1px rgba(46,155,255,0.6), 0 0 6px rgba(46,155,255,0.25)' }}
            initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: delay + i * 0.08 }}
            whileHover={{ scale: 1.03 }} onClick={() => pick(i)}>
            <span className="shrink-0 w-[22px] flex justify-center"><BoonIcon boon={boon} /></span>
            <span className="flex flex-col min-w-0 leading-[10px]" style={{ fontSize: 9 }}>
              <span style={{ color: 'var(--ink-cream)' }}>{title}</span>
              <span style={{ color: 'var(--ink-mint)' }}>{desc}</span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
};
