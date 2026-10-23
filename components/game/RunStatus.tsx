import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CardTemplate, CastleRun } from '@/lib/castle';
import { RANKS } from '@/lib/game-utils';
import { STARTING_LIVES } from '@/lib/constants';
import { useTranslations } from '@/lib/i18n';
import { playSfx } from '@/lib/sounds';
import { INK } from '@/theme/tokens';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { CHARACTERS, HEART, HEART_LOST, SEAL_ICONS } from '@/components/pixel/sprites';

// --- ESTADO DE LA SUBIDA (en el mercader y en el cofre) ---
// Para decidir bien: tus vidas (las de más que dio el mercader, en azul) y un botón
// con tu mazo que despliega todas tus cartas en miniatura.

/** Carta en miniatura: número o figura, su sello, su +N y su color de origen */
export const MiniCard = ({ c }: { c: CardTemplate }) => {
  const legendary = !!RANKS[c.rank].legendary;
  const seal = c.rank === 'SEAL';
  const figure = !seal && CHARACTERS[c.rank];
  const ring = legendary ? 'inset 0 0 0 1px var(--ink-gold), 0 0 4px rgba(232,182,74,0.6)'
    : c.merchant ? 'inset 0 0 0 1px var(--ink-azure)' : 'inset 0 0 0 1px rgba(185,207,200,0.25)';
  const bg = seal ? (c.merchant ? 'var(--ink-azure)' : 'var(--ink-volt)') : c.merchant || legendary ? 'rgba(46,155,255,0.35)' : 'var(--ink-slate)';
  return (
    <span className="relative flex items-center justify-center rounded-[2px]" style={{ width: 16, height: 21, background: bg, boxShadow: ring }}>
      {seal ? (c.wild ? <span className="font-display" style={{ fontSize: 9, color: 'var(--ink-black)' }}>?</span>
        : <PixelSprite sprite={SEAL_ICONS[c.seal!]} tint={INK.black} />)
        : figure && c.rank !== 'J' && c.rank !== 'Q' && c.rank !== 'K' && c.rank !== 'A'
          ? <PixelSprite sprite={figure} tint={legendary ? INK.gold : INK.cream} style={{ width: 9, height: 11.5 }} />
          : <span className="font-display" style={{ fontSize: c.rank === '10' || c.rank === 'JOKER' ? 7 : 9, lineHeight: '9px', color: 'var(--ink-cream)' }}>{c.rank === 'JOKER' ? 'JK' : c.rank}</span>}
      {/* Sello permanente: puntito verde arriba a la derecha */}
      {!seal && c.seal && (
        <span className="absolute rounded-full" style={{ right: -2, top: -2, width: 7, height: 7, background: 'var(--ink-volt)', boxShadow: '0 0 3px rgba(125,255,43,0.8)' }} />
      )}
      {/* Mejora: +N en azul abajo */}
      {!!c.bonus && (
        <span className="absolute font-display" style={{ bottom: -3, right: -2, fontSize: 6, lineHeight: '6px', padding: '1px 1px 0', background: 'var(--ink-azure)', color: 'var(--ink-black)', borderRadius: 1 }}>+{c.bonus}</span>
      )}
    </span>
  );
};

/** `width`: ancho fijo (escena del mercader); sin él, ocupa el de su contenedor */
export const RunStatus = ({ run, width }: { run: CastleRun; width?: number }) => {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const toggle = () => { playSfx(open ? 'deselect' : 'open', 0.6); setOpen(o => !o); };
  // Orden de lectura: cartas normales por valor, luego las del Castillo, luego sellos
  const deck = [...run.deck].sort((a, b) => {
    const ka = a.rank === 'SEAL' ? 2 : RANKS[a.rank].castle ? 1 : 0;
    const kb = b.rank === 'SEAL' ? 2 : RANKS[b.rank].castle ? 1 : 0;
    return ka - kb || RANKS[a.rank].value - RANKS[b.rank].value;
  });
  return (
    <div className="relative flex items-center justify-between gap-[6px]" style={{ width: width ?? '100%' }}>
      {/* Tus vidas: las de partida en naranja, las que dio el mercader en azul */}
      <span className="flex gap-[1px]" aria-label={`lives ${run.lives}/${run.maxLives}`}>
        {Array.from({ length: run.maxLives }, (_, i) => {
          const extra = i >= STARTING_LIVES;
          return <PixelSprite key={i} sprite={i < run.lives ? HEART : HEART_LOST}
            tint={i < run.lives ? (extra ? INK.azure : INK.orange) : INK.slate}
            className={i < run.lives ? (extra ? 'bloom-azure-shape' : 'bloom-shape') : undefined} />;
        })}
      </span>
      <button aria-label={t.aria_run_deck} onClick={toggle}
        className="font-display px-[5px] rounded-[2px] cursor-pointer"
        style={{ fontSize: 8, lineHeight: '11px', height: 11, paddingTop: 1, color: open ? 'var(--ink-black)' : 'var(--ink-azure)',
          background: open ? 'var(--ink-azure)' : 'transparent', boxShadow: 'inset 0 0 0 1px var(--ink-azure)' }}>
        {t.run_deck.replace('{n}', String(run.deck.length))}
      </button>
      {/* El mazo, desplegado encima de lo que haya debajo; se cierra tocándolo */}
      <AnimatePresence>
        {open && (
          <motion.button key="deck" aria-label={t.aria_close_run_deck} onClick={toggle}
            className="absolute left-0 z-30 flex flex-col gap-[4px] p-[5px] rounded-[3px] text-left cursor-pointer"
            style={{ top: 15, width: width ?? '100%', background: 'rgba(11,13,12,0.97)', boxShadow: 'inset 0 0 0 1px rgba(46,155,255,0.6), 0 6px 16px rgba(0,0,0,0.6)' }}
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}>
            <span className="t-micro" style={{ color: 'var(--ink-cream)' }}>{t.run_deck_title.replace('{n}', String(run.deck.length))}</span>
            <span className="flex flex-wrap gap-[3px]">
              {deck.map((c, i) => <MiniCard key={i} c={c} />)}
            </span>
            <span className="t-micro self-center" style={{ color: 'var(--ink-teal)' }}>{t.run_deck_close}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
