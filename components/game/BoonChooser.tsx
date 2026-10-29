import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Rank } from '@/types';
import { Boon, boonRarity, CardTemplate, chooseBoon, getCastle, Rarity } from '@/lib/castle';
import { Translations, useTranslations } from '@/lib/i18n';
import { playSfx, playSound } from '@/lib/sounds';
import { INK } from '@/theme/tokens';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { CHARACTERS, CHECK, HEART, SEAL_ICONS, STAR } from '@/components/pixel/sprites';
import { useGameStore } from '@/store/useGameStore';
import { track } from '@/lib/analytics';

// --- MEJORAS DEL CASTILLO (el género del mercader) ---
// Tras vencer a un jefe del Castillo el mercader te ofrece 3 mejoras; eliges 1 y sube
// el siguiente. Todo lo que sale de él va en azul eléctrico.

const CASTLE_NAMES: Partial<Record<Rank, keyof Translations>> = {
  JESTER: 'idea_jester', TOWER: 'idea_tower', BOMB: 'idea_bomb', SPY: 'idea_spy', KNIGHT: 'idea_knight', PRIESTESS: 'idea_priestess',
  DRAGON: 'idea_dragon', HYDRA: 'idea_hydra', PHOENIX: 'idea_phoenix',
};

/** Nombre de una carta para los textos de las mejoras */
export const cardName = (t: Translations, c: CardTemplate | { rank: Rank | 'WILD' }): string => {
  if (c.rank === 'WILD' || ('wild' in c && c.wild)) return t.idea_wild_seal;
  if (c.rank === 'SEAL' && 'seal' in c && c.seal) return t[`seal_${c.seal}` as keyof Translations];
  const castle = CASTLE_NAMES[c.rank as Rank];
  const base = castle ? t[castle] : c.rank === 'JOKER' ? 'Joker' : c.rank;
  return 'bonus' in c && c.bonus ? `${base} (+${c.bonus})` : base;
};

export const boonText = (t: Translations, boon: Boon, deck: CardTemplate[]): { title: string; desc: string } => {
  const title = t[`boon_${boon.kind}` as keyof Translations];
  switch (boon.kind) {
    case 'card': return { title, desc: t.boon_card_desc.replace('{card}', cardName(t, boon)) };
    case 'seal': return { title, desc: t.boon_seal_desc.replace('{card}', cardName(t, deck[boon.target])).replace('{seal}', t[`seal_${boon.seal}` as keyof Translations]) };
    case 'upgrade': return { title, desc: t.boon_upgrade_desc.replace('{card}', cardName(t, deck[boon.target])) };
    case 'purge': return { title, desc: t.boon_purge_desc.replace('{cards}', boon.targets.map(i => cardName(t, deck[i])).join(' + ')) };
    default: return { title, desc: t[`boon_${boon.kind}_desc` as keyof Translations] };
  }
};

/** Rareza: común en menta, rara en azul, legendaria en oro (con brillo que pasa) */
export const RARITY_UI: Record<Rarity, { color: string; label: keyof Translations; ring: string; ringCompact: string }> = {
  common: { color: 'var(--ink-mint)', label: 'rarity_common', ring: 'inset 0 0 0 1px rgba(46,155,255,0.6), 0 0 6px rgba(46,155,255,0.25)', ringCompact: 'inset 0 0 0 1px rgba(46,155,255,0.35)' },
  rare: { color: 'var(--ink-azure)', label: 'rarity_rare', ring: 'inset 0 0 0 1px rgba(46,155,255,0.95), 0 0 8px rgba(46,155,255,0.5)', ringCompact: 'inset 0 0 0 1px rgba(46,155,255,0.85), 0 0 6px rgba(46,155,255,0.35)' },
  legendary: { color: 'var(--ink-gold)', label: 'rarity_legendary', ring: 'inset 0 0 0 1px rgba(232,182,74,1), 0 0 10px rgba(232,182,74,0.6)', ringCompact: 'inset 0 0 0 1px rgba(232,182,74,1), 0 0 8px rgba(232,182,74,0.55)' },
};

export const BoonIcon = ({ boon }: { boon: Boon }) => {
  const shape = boonRarity(boon) === 'legendary' ? { tint: INK.gold, className: 'bloom-gold-shape' } : { tint: INK.azure, className: 'bloom-azure-shape' };
  if (boon.kind === 'heal' || boon.kind === 'maxLife') return <PixelSprite sprite={HEART} {...shape} />;
  if (boon.kind === 'seal') return <PixelSprite sprite={SEAL_ICONS[boon.seal]} {...shape} />;
  if (boon.kind === 'card' && boon.rank !== 'WILD') return <PixelSprite sprite={CHARACTERS[boon.rank]!} {...shape} />;
  if (boon.kind === 'pact') return <PixelSprite sprite={STAR} {...shape} />;
  return <span className="font-display glow-azure" style={{ color: 'var(--ink-azure)', fontSize: 14 }}>{boon.kind === 'card' ? '?' : boon.kind === 'upgrade' ? '+2' : '−'}</span>;
};

/** Lo que tarda cada mejora en entrar */
const ENTER_S = 0.35;
/** Lo que dura la elección en pantalla (salta, destella y se marca) antes de seguir */
const CHOSEN_MS = 700;

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
  // La elegida: se marca un instante y luego se aplica (no se puede elegir otra)
  const [chosen, setChosen] = useState<number | null>(null);
  const chosenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (chosenTimer.current) clearTimeout(chosenTimer.current); }, []);
  if (!run?.offer) return null;
  const pick = (i: number) => {
    if (!ready || chosen !== null) return;
    // Analíticas: qué se elige de lo que ofrece el mercader
    const boon = run.offer![i];
    track('merchant_choice', {
      kind: boon.kind, rarity: boonRarity(boon), card: boon.kind === 'card' ? boon.rank : null, seal: boon.kind === 'seal' ? boon.seal : null,
      floor: run.stage, lives: run.lives, max_lives: run.maxLives, deck_size: run.deck.length,
      offered: run.offer!.map(b => (b.kind === 'card' ? `card:${b.rank}` : b.kind)), slot: i, place: compact ? 'scene' : 'menu',
    });
    playSound('click');
    playSfx('sparkle');
    playSfx('select', 0.8, 1.2);
    setChosen(i);
    chosenTimer.current = setTimeout(() => {
      if (!chooseBoon(i)) return;
      if (onChosen) onChosen();
      else useGameStore.getState().startCastle();
    }, CHOSEN_MS);
  };
  return (
    <div className={clsx('flex flex-col w-full', compact ? 'gap-[3px]' : 'gap-[4px]')}>
      <motion.span className={clsx('text-center glow-azure', compact && 't-micro')} style={{ color: 'var(--ink-azure)', letterSpacing: compact ? 1 : undefined }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.max(0, delay - 0.1) }}>{t.castle_choose}</motion.span>
      {run.offer.map((boon, i) => {
        const { title, desc } = boonText(t, boon, run.deck);
        const rarity = boonRarity(boon);
        const ui = RARITY_UI[rarity];
        return (
          <motion.button key={i} aria-label={`boon ${boon.kind}`} data-rarity={rarity}
            className={clsx('relative overflow-hidden px-inset px-round flex items-center text-left cursor-pointer', compact ? 'gap-[4px] p-[3px]' : 'gap-[6px] p-[4px]')}
            style={{ boxShadow: compact ? ui.ringCompact : ui.ring, background: compact ? 'rgba(11,13,12,0.7)' : undefined }}
            initial={{ x: 20, opacity: 0 }}
            // Elegida: salta y se queda un poco más grande; las otras se apagan
            animate={chosen === null ? { x: 0, opacity: 1, scale: 1 } : chosen === i ? { x: 0, opacity: 1, scale: [1, 1.12, 1.05] } : { x: 0, opacity: 0.25, scale: 0.94 }}
            transition={chosen === null ? { delay: delay + i * 0.08, duration: ENTER_S } : { duration: 0.35, ease: 'easeOut' }}
            whileHover={chosen === null ? { scale: 1.03 } : undefined} onClick={() => pick(i)}>
            {chosen === i && (
              <>
                {/* Destello crema y el marco que brilla en el color de su rareza */}
                <motion.span className="absolute inset-0 pointer-events-none" style={{ background: 'var(--ink-cream)' }}
                  initial={{ opacity: 0.85 }} animate={{ opacity: 0 }} transition={{ duration: 0.45, ease: 'easeOut' }} />
                <motion.span className="absolute inset-0 pointer-events-none px-round"
                  style={{ boxShadow: `inset 0 0 0 2px ${ui.color}, 0 0 12px 3px ${ui.color}` }}
                  initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.75] }} transition={{ duration: 0.5 }} />
                {/* Marca de elegida (en el sitio de la rareza) */}
                <motion.span className="absolute right-[3px] top-[3px] pointer-events-none" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 14, delay: 0.1 }}>
                  <PixelSprite sprite={CHECK} tint={INK.cream} className="bloom-cream" />
                </motion.span>
              </>
            )}
            <span className={clsx('shrink-0 flex justify-center', compact ? 'w-[16px]' : 'w-[22px]')}><BoonIcon boon={boon} /></span>
            {/* Legendaria: un brillo dorado que cruza la fila */}
            {rarity === 'legendary' && <span className="absolute inset-y-0 left-0 w-[30%] pointer-events-none anim-shine" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,233,168,0.35), transparent)' }} />}
            <span className={clsx('flex flex-col min-w-0 flex-1', compact ? 'leading-[9px]' : 'leading-[10px]')} style={{ fontSize: compact ? 8 : 9 }}>
              <span className="flex items-center justify-between gap-[4px]">
                <span style={{ color: rarity === 'legendary' ? 'var(--ink-gold)' : 'var(--ink-cream)' }}>{title}</span>
                <span className="font-display shrink-0" style={{ color: ui.color, fontSize: 7, letterSpacing: 1, opacity: chosen === i ? 0 : 1 }}>{t[ui.label]}</span>
              </span>
              <span style={{ color: 'var(--ink-mint)' }}>{desc}</span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
};
