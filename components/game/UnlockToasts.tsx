import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { useUiStore } from '@/store/useUiStore';
import { useTranslations, Translations } from '@/lib/i18n';
import { haptic, playSfx } from '@/lib/sounds';
import { INK } from '@/theme/tokens';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { ICONS, SEAL_ICONS } from '@/components/pixel/sprites';
import { BossFigure } from './BossFigure';
import { CardBack } from './Card';
import { clsx } from 'clsx';
import { CARD_SIZE } from '@/theme/tokens';
import { useStage } from '@/components/pixel/Stage';

// --- DESBLOQUEOS DE BOSS ---
// Al vencer a un boss: un sello nuevo (o la colección, con el primero) aparece en verde
// eléctrico en el centro. Espera a que acabe la pelea y va antes que los logros.

export const UnlockToasts = () => {
  const t = useTranslations();
  const { width, height } = useStage();
  const current = useUiStore(s => s.unlockQueue[0]);
  const shift = useUiStore(s => s.shiftUnlock);
  // Espera a que termine la pelea (también el repaso del resultado) para no taparla
  const busy = useGameStore(s => s.phase === 'combat' || s.phase === 'combat-reveal');
  // Con una ventana abierta, el aviso espera a que se cierre
  const modalOpen = useUiStore(s => !!s.modal || s.cinematic);
  // El premio del boss va primero; los logros esperan a que termine
  const show = current && !busy && !modalOpen;

  // El jefe secreto y el Castillo los cuenta el mapa del menú, por fases
  const onMap = current?.kind === 'secret' || current?.kind === 'castle';
  useEffect(() => { if (onMap) shift(); }, [onMap, current, shift]);

  useEffect(() => {
    if (!show || onMap) return;
    const slam = setTimeout(() => { playSfx('wipe', 0.6, 1.3); playSfx('sparkle'); haptic('win'); }, 150);
    const done = setTimeout(shift, 3600);
    return () => { clearTimeout(slam); clearTimeout(done); };
  }, [show, onMap, current, shift]);

  const w = Math.min(210, width - 16);
  const seal = current?.kind === 'seal' ? current.seal : null;
  const kind = current?.kind ?? 'collection';
  const backBoss = current?.kind === 'back' ? current.boss : null;
  const castle = kind === 'castle';
  const title = { seal: t.unlock_seal, collection: t.unlock_collection, secret: t.unlock_secret, editor: t.unlock_editor, back: t.unlock_back, castle: t.unlock_castle }[kind];
  const desc = seal ? `${t[`seal_${seal}_desc` as keyof Translations]} ${t.unlock_seal_desc}`
    : backBoss ? t.unlock_back_desc.replace('{boss}', t[`boss_${backBoss}` as keyof Translations])
      : { seal: '', back: '', collection: t.unlock_collection_desc, secret: t.unlock_secret_desc, editor: t.unlock_editor_desc, castle: t.unlock_castle_desc }[kind];
  // El Castillo se anuncia en rojo eléctrico; lo demás, en verde
  // El Grimorio (con el editor de mazo) va en naranja, como sus botones del menú
  const grim = kind === 'collection';
  const rgb = castle ? '255,31,75' : grim ? '255,74,28' : '125,255,43';
  return (
    <AnimatePresence>
      {show && !onMap && (
        <motion.button
          key={seal ?? backBoss ?? kind}
          className="absolute z-[300] flex flex-col items-center gap-[8px] cursor-pointer"
          style={{ left: (width - w) / 2, top: Math.round(height * 0.24), width: w }}
          onClick={shift}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -12, transition: { duration: 0.25 } }}
        >
          <div className="relative">
            <motion.div className="absolute rounded-full" style={{ inset: -10, boxShadow: `0 0 0 2px rgba(${rgb},0.8), 0 0 22px 6px rgba(${rgb},0.4)` }}
              initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: [0.5, 1.6], opacity: [0, 1, 0] }} transition={{ duration: 0.8, delay: 0.15 }} />
            <motion.div className={backBoss ? 'relative' : clsx('flex items-center justify-center rounded-full', castle ? 'bloom-crimson' : grim ? 'bloom' : 'bloom-volt')}
              style={backBoss ? { width: CARD_SIZE.width, height: CARD_SIZE.height } : { width: 54, height: 54, background: castle
                ? 'radial-gradient(circle at 45% 40%, #FF9AAE 0%, var(--ink-crimson) 60%, #8A0A24 100%)'
                : grim ? 'radial-gradient(circle at 45% 40%, var(--ink-ember) 0%, var(--ink-orange) 60%, #A82A0C 100%)'
                : 'radial-gradient(circle at 45% 40%, #D8FF9A 0%, var(--ink-volt) 55%, #4FC414 100%)' }}
              initial={{ scale: 3, rotate: -30, opacity: 0, filter: 'blur(4px)' }}
              animate={{ scale: 1, rotate: 0, opacity: 1, filter: 'blur(0px)' }}
              transition={{ type: 'spring', stiffness: 480, damping: 15 }}>
              {backBoss ? <CardBack owner="player" back={backBoss} />
                : kind === 'secret' || castle
                ? <BossFigure id="sovereign" height={44} dark glow={false} />
                : kind === 'collection'
                  // El Grimorio y, a su lado, el mazo (se abren los dos a la vez)
                  ? <span className="flex items-center gap-[3px]"><PixelSprite sprite={ICONS.book} tint={INK.black} scale={3} /><PixelSprite sprite={ICONS.deck} tint={INK.black} scale={2} /></span>
                  : <PixelSprite sprite={kind === 'editor' ? ICONS.gear : SEAL_ICONS[seal ?? 'shield']} tint={INK.black} scale={kind === 'editor' ? 4 : 3} />}
            </motion.div>
          </div>
          <motion.div className="px-panel px-round px-[8px] py-[6px] flex flex-col items-center gap-[3px] w-full" data-popover
            style={{ boxShadow: `0 0 0 1px rgba(${rgb},0.55), 0 0 14px 2px rgba(${rgb},0.25)` }}
            initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
            <span className={clsx('font-display', castle ? 'glow-crimson' : grim ? 'glow-text' : 'glow-volt')} style={{ color: castle ? 'var(--ink-crimson)' : grim ? 'var(--ink-orange)' : 'var(--ink-volt)', fontSize: 12 }}>
              {title}
            </span>
            {seal && <span className="text-title text-outline">{t[`seal_${seal}` as keyof Translations]}</span>}
            <span className="text-center leading-[11px]" style={{ color: 'var(--ink-mint)' }}>
              {desc}
            </span>
          </motion.div>
        </motion.button>
      )}
    </AnimatePresence>
  );
};
