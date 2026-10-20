import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { clsx } from 'clsx';
import { useTranslations, Translations } from '@/lib/i18n';
import { BOSSES, currentBossIndex, getProgress, getServerProgress, subscribeProgress } from '@/lib/bosses';
import { INK } from '@/theme/tokens';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { SEAL_ICONS } from '@/components/pixel/sprites';
import { BossFigure } from '@/components/game/BossFigure';
import { playSfx } from '@/lib/sounds';

// --- LISTA DE BOSSES (menú) ---
// Una página por boss, deslizable en horizontal (con imán). Empieza en el boss a
// derrotar: grande, en naranja y con su sello verde. Los vencidos dicen VENCIDO; los
// futuros salen apagados y sin nombre, pero con su premio a la vista.

export const BossCarousel = ({ left, top, width, height }: { left: number; top: number; width: number; height: number }) => {
  const t = useTranslations();
  const progress = useSyncExternalStore(subscribeProgress, getProgress, getServerProgress);
  const current = currentBossIndex(progress);
  const ref = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(current);

  // Al abrir el menú (o al vencer a uno) se coloca en el boss actual
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollLeft = current * width;
  }, [current, width]);

  const figureH = Math.min(126, height - 46);

  return (
    <div className="absolute z-20" style={{ left, top, width, height }}>
      <div
        ref={ref}
        className="no-scrollbar absolute inset-0 flex overflow-x-auto overflow-y-hidden"
        style={{ scrollSnapType: 'x mandatory', touchAction: 'pan-x', overscrollBehaviorX: 'contain' }}
        onScroll={e => {
          const p = Math.round(e.currentTarget.scrollLeft / width);
          if (p !== page) { setPage(p); playSfx('flip', 0.5, 1.2); }
        }}
      >
        {BOSSES.map((boss, i) => {
          const beaten = i < progress.defeated;
          const isCurrent = i === current;
          const locked = i > current;
          return (
            <div key={boss.id} className="shrink-0 flex flex-col items-center justify-center gap-[3px]"
              style={{ width, height, scrollSnapAlign: 'center' }}>
              <span className={clsx('font-display', isCurrent && !beaten && 'glow-text')}
                style={{ fontSize: 10, lineHeight: '10px', color: isCurrent && !beaten ? 'var(--ink-orange)' : 'var(--ink-teal)' }}>
                {isCurrent && !beaten ? t.next_rival : beaten ? (isCurrent ? t.rematch : t.beaten) : `${i + 1} / ${BOSSES.length}`}
              </span>
              <div className={isCurrent ? 'anim-breathe' : undefined} style={{ opacity: beaten && !isCurrent ? 0.55 : 1 }}>
                <BossFigure id={boss.id} height={figureH} dim={locked} />
              </div>
              <span className="text-outline" style={{ fontSize: 12, lineHeight: '12px' }}>
                {locked ? '???' : t[`boss_${boss.id}` as keyof Translations]}
              </span>
              {/* Premio: su sello (o la colección, con el primero) */}
              <span className="flex items-center gap-[3px]" style={{ color: 'var(--ink-mint)', fontSize: 9, lineHeight: '9px' }}>
                {t.reward}:
                {boss.seal ? (
                  <>
                    <PixelSprite sprite={SEAL_ICONS[boss.seal]} tint={INK.volt} className="bloom-volt-shape" />
                    <span className="glow-volt" style={{ color: 'var(--ink-volt)' }}>{t[`seal_${boss.seal}` as keyof Translations]}</span>
                  </>
                ) : <span className="glow-volt" style={{ color: 'var(--ink-volt)' }}>{t.reward_collection}</span>}
              </span>
            </div>
          );
        })}
      </div>
      {/* Puntos de página */}
      <div className="absolute left-0 right-0 flex justify-center gap-[3px] pointer-events-none" style={{ bottom: -6 }}>
        {BOSSES.map((b, i) => (
          <span key={b.id} className="rounded-full" style={{
            width: 4, height: 4,
            background: i === page ? 'var(--ink-orange)' : i < progress.defeated ? 'var(--ink-teal)' : 'var(--ink-slate)',
            boxShadow: i === page ? '0 0 3px rgba(255,74,28,0.8)' : undefined,
          }} />
        ))}
      </div>
    </div>
  );
};
