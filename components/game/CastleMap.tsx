import { Fragment } from 'react';
import { motion } from 'framer-motion';
import { CASTLE_LENGTH, isCheckpointFloor, isChestFloor } from '@/lib/castle';
import { INK } from '@/theme/tokens';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { HALO, STAR } from '@/components/pixel/sprites';

// --- MAPA DE LA SUBIDA ---
// Los 12 pisos en fila, de abajo (izquierda) a arriba (derecha): los vencidos, rellenos
// de carmesí; el siguiente, un anillo que late; los que faltan, apagados. Entre los
// pisos 3-4, 6-7 y 9-10 va un cofre (oro; apagado si ya lo abriste). El último piso es
// el Soberano: una estrella. `justCleared` anima el piso recién vencido.
// Antes de los pisos 4 y 8, un hueco más: el halo del Ángel (el punto de guardado), en el
// orden de las escenas (Ángel, cofre, piso). Apagado mientras no es tuyo; encendido en
// oro, con brillo, el del punto que tienes guardado. Con «Sin caer» no hay Ángel.

const Chest = ({ opened }: { opened: boolean }) => (
  <span className="relative shrink-0" style={{ width: 6, height: 5, opacity: opened ? 0.35 : 1 }}>
    <span className="absolute inset-x-0 top-0" style={{ height: 2, background: 'var(--ink-gold)', borderRadius: '1px 1px 0 0' }} />
    <span className="absolute inset-x-0 bottom-0" style={{ height: 3, background: 'var(--ink-crimson)', boxShadow: opened ? undefined : '0 0 3px rgba(232,182,74,0.8)' }} />
  </span>
);

/** El halo del Ángel: el punto de guardado (encendido si es el que tienes guardado) */
const Angel = ({ saved }: { saved: boolean }) => (
  <span className="shrink-0" style={{ opacity: saved ? 1 : 0.45 }} aria-label={saved ? 'checkpoint saved' : 'checkpoint'}>
    <PixelSprite sprite={HALO} tint={saved ? INK.gold : INK.teal} className={saved ? 'bloom-gold-shape' : undefined} />
  </span>
);

export const CastleMap = ({ stage, justCleared, chestPending, saved, noCheckpoints }: {
  /** Piso al que te enfrentas ahora (índice): los anteriores están vencidos */
  stage: number;
  justCleared?: boolean;
  /** El cofre de este piso aún está por abrir */
  chestPending?: boolean;
  /** Punto de guardado que tienes (índice del piso), si lo hay */
  saved?: number;
  /** Desafío «Sin caer»: no hay puntos de guardado */
  noCheckpoints?: boolean;
}) => (
  <div className="flex items-center gap-[2px]" aria-label={`map ${stage}/${CASTLE_LENGTH}`}>
    {Array.from({ length: CASTLE_LENGTH }, (_, i) => {
      const cleared = i < stage;
      const current = i === stage;
      const last = i === CASTLE_LENGTH - 1;
      const fresh = justCleared && i === stage - 1;
      return (
        <Fragment key={i}>
          {isCheckpointFloor(i) && !noCheckpoints && <Angel saved={saved === i} />}
          {i > 0 && isChestFloor(i) && <Chest opened={stage > i || (stage === i && !chestPending)} />}
          {last ? (
            <span className={current ? 'anim-throb' : undefined} style={{ opacity: cleared || current ? 1 : 0.45 }}>
              <PixelSprite sprite={STAR} tint={current ? INK.gold : cleared ? INK.crimson : INK.slate} className={current ? 'bloom-gold-shape' : undefined} />
            </span>
          ) : (
            <motion.span className={current ? 'anim-throb' : undefined}
              style={{
                width: 6, height: 6, borderRadius: 1,
                background: cleared ? 'var(--ink-crimson)' : 'transparent',
                boxShadow: cleared ? '0 0 3px rgba(255,31,75,0.7)' : current ? 'inset 0 0 0 1px var(--ink-crimson), 0 0 4px rgba(255,31,75,0.8)' : 'inset 0 0 0 1px var(--ink-slate)',
              }}
              initial={fresh ? { scale: 2.4, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.6, type: 'spring', stiffness: 420, damping: 14 }} />
          )}
        </Fragment>
      );
    })}
  </div>
);
