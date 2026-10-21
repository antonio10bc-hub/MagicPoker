import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
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

/** Lo que tarda cada mejora en entrar */
const ENTER_S = 0.35;

/** Las 3 mejoras de la subida en curso. `onChosen` se llama tras elegir (por defecto, sube
 *  al siguiente jefe). `compact`: letra y filas más pequeñas (escena del mercader). */
export const BoonChooser = ({ onChosen, delay = 0.15, compact }: { onChosen?: () => void; delay?: number; compact?: boolean }) => {
  const t = useTranslations();
  // Se fija al aparecer: al elegir, la oferta se borra y la lista no debe saltar
  const [run] = useState(() => getCastle().run);
  // No se puede elegir hasta que se ven las 3 (un toque rápido no coge nada a ciegas)
  const [ready, setReady] = useState(false);
  const count = run?.offer?.length ?? 0;
  useEffect(() => {
    const id = setTimeout(() => setReady(true), (delay + Math.max(0, count - 1) * 0.08 + ENTER_S) * 1000);
    return () => clearTimeout(id);
  }, [delay, count]);
  if (!run?.offer) return null;
  const pick = (i: number) => {
    if (!ready) return;
    playSound('click');
    playSfx('sparkle');
    if (!chooseBoon(i)) return;
    if (onChosen) onChosen();
    else useGameStore.getState().startCastle();
  };
  return (
    <div className={clsx('flex flex-col w-full', compact ? 'gap-[3px]' : 'gap-[4px]')}>
      <motion.span className={clsx('text-center glow-azure', compact && 't-micro')} style={{ color: 'var(--ink-azure)', letterSpacing: compact ? 1 : undefined }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.max(0, delay - 0.1) }}>{t.castle_choose}</motion.span>
      {run.offer.map((boon, i) => {
        const { title, desc } = boonText(t, boon, run.deck);
        return (
          <motion.button key={i} aria-label={`boon ${boon.kind}`}
            className={clsx('px-inset px-round flex items-center text-left cursor-pointer', compact ? 'gap-[4px] p-[3px]' : 'gap-[6px] p-[4px]')}
            style={{ boxShadow: compact ? 'inset 0 0 0 1px rgba(46,155,255,0.35)' : 'inset 0 0 0 1px rgba(46,155,255,0.6), 0 0 6px rgba(46,155,255,0.25)', background: compact ? 'rgba(11,13,12,0.7)' : undefined }}
            initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: delay + i * 0.08, duration: ENTER_S }}
            whileHover={{ scale: 1.03 }} onClick={() => pick(i)}>
            <span className={clsx('shrink-0 flex justify-center', compact ? 'w-[16px]' : 'w-[22px]')}><BoonIcon boon={boon} /></span>
            <span className={clsx('flex flex-col min-w-0', compact ? 'leading-[9px]' : 'leading-[10px]')} style={{ fontSize: compact ? 8 : 9 }}>
              <span style={{ color: 'var(--ink-cream)' }}>{title}</span>
              <span style={{ color: 'var(--ink-mint)' }}>{desc}</span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
};
