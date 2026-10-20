import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { clsx } from 'clsx';
import { useTranslations, Translations } from '@/lib/i18n';
import { useUiStore } from '@/store/useUiStore';
import { getCastle, getServerCastle, subscribeCastle } from '@/lib/castle';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { CASTLE_SPRITE } from '@/components/pixel/bosses';
import { INK } from '@/theme/tokens';
import { BOSSES, bossWins, isCastleUnlocked, currentBossIndex, getProgress, getServerProgress, isBossVisible, subscribeProgress, WINS_FOR_BACK } from '@/lib/bosses';
import { BossFigure } from '@/components/game/BossFigure';
import { playSfx } from '@/lib/sounds';

// --- LISTA DE BOSSES (menú) ---
// Una página por boss, deslizable en horizontal (con imán). Empieza en el boss a
// derrotar: grande, en naranja y con su sello verde. Los vencidos dicen VENCIDO y se
// pueden repetir (JUGAR juega contra el que está en pantalla); los futuros salen
// apagados y sin nombre.

export const BossCarousel = ({ left, top, width, height }: { left: number; top: number; width: number; height: number }) => {
  const t = useTranslations();
  const progress = useSyncExternalStore(subscribeProgress, getProgress, getServerProgress);
  const current = currentBossIndex(progress);
  const ref = useRef<HTMLDivElement>(null);
  const castleOpen = isCastleUnlocked(progress);
  const castle = useSyncExternalStore(subscribeCastle, getCastle, getServerCastle);
  // Con el Castillo abierto, el menú arranca en él
  const start = castleOpen ? BOSSES.length : current;
  const [page, setPage] = useState(start);
  const setMenuBoss = useUiStore(s => s.setMenuBoss);

  // Al abrir el menú (o al vencer a uno) se coloca en el boss actual
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollLeft = start * width;
    setMenuBoss(start);
  }, [start, width, setMenuBoss]);

  const figureH = Math.min(100, height - 40);
  // El jefe secreto no sale hasta que lo alcanzas
  const shown = BOSSES.filter((_, i) => isBossVisible(i, progress));

  return (
    <div className="absolute z-20" style={{ left, top, width, height }}>
      <div
        ref={ref}
        className="no-scrollbar absolute inset-0 flex overflow-x-auto overflow-y-hidden"
        style={{ scrollSnapType: 'x mandatory', touchAction: 'pan-x', overscrollBehaviorX: 'contain' }}
        onScroll={e => {
          const p = Math.round(e.currentTarget.scrollLeft / width);
          if (p !== page) { setPage(p); setMenuBoss(p); playSfx('flip', 0.5, 1.2); }
        }}
      >
        {shown.map((boss, i) => {
          const beaten = i < progress.defeated;
          // Victorias contra él (la primera y las revanchas): con 5, su dorso
          const wins = bossWins(i, progress);
          const backWon = wins >= WINS_FOR_BACK;
          const isCurrent = i === current;
          const locked = i > current;
          return (
            <div key={boss.id} className="shrink-0 flex flex-col items-center justify-center gap-[3px]"
              style={{ width, height, scrollSnapAlign: 'center' }}>
              <span className={clsx('font-display', isCurrent && !beaten && 'glow-text')}
                style={{ fontSize: 10, lineHeight: '10px', color: isCurrent && !beaten ? 'var(--ink-orange)' : 'var(--ink-teal)' }}>
                {isCurrent && !beaten ? (boss.secret ? t.secret_boss : t.next_rival) : beaten ? t.beaten : `${i + 1} / ${shown.length}`}
                {beaten && (
                  <span style={{ color: backWon ? 'var(--ink-gold)' : wins > 1 ? 'var(--ink-volt)' : 'var(--ink-teal)' }}>
                    {' · '}{t.wins_count.replace('{n}', String(Math.min(wins, WINS_FOR_BACK)))}
                  </span>
                )}
              </span>
              <div className={isCurrent ? 'anim-breathe' : undefined} style={{ opacity: beaten && !isCurrent ? 0.55 : 1 }}>
                <BossFigure id={boss.id} height={figureH} dim={locked} />
              </div>
              <span className="text-outline" style={{ fontSize: 12, lineHeight: '12px' }}>
                {locked ? '???' : t[`boss_${boss.id}` as keyof Translations]}
              </span>
            </div>
          );
        })}
        {/* El Castillo: "un jefe más" al final de la lista, en rojo eléctrico */}
        {castleOpen && (
          <div className="shrink-0 flex flex-col items-center justify-center gap-[3px]" style={{ width, height, scrollSnapAlign: 'center' }}>
            <span className="font-display glow-crimson" style={{ fontSize: 10, lineHeight: '10px', color: 'var(--ink-crimson)' }}>
              {castle.run ? t.castle_floor.replace('{n}', String(castle.run.stage + 1)).replace('{total}', String(BOSSES.length))
                : t.castle_best.replace('{n}', String(castle.best)).replace('{total}', String(BOSSES.length))}
            </span>
            <div className="anim-breathe">
              <PixelSprite sprite={CASTLE_SPRITE} tint={INK.crimson} className="bloom-crimson-shape"
                style={{ width: Math.round(figureH * 32 / 41), height: figureH }} />
            </div>
            <span className="text-outline glow-crimson" style={{ fontSize: 12, lineHeight: '12px', color: 'var(--ink-crimson)' }}>{t.castle_title}</span>
          </div>
        )}
      </div>
      {/* Puntos de página */}
      <div className="absolute left-0 right-0 flex justify-center gap-[3px] pointer-events-none" style={{ bottom: -6 }}>
        {shown.map((b, i) => (
          <span key={b.id} className="rounded-full" style={{
            width: 4, height: 4,
            background: i === page ? 'var(--ink-orange)' : i < progress.defeated ? 'var(--ink-teal)' : 'var(--ink-slate)',
            boxShadow: i === page ? '0 0 3px rgba(255,74,28,0.8)' : undefined,
          }} />
        ))}
        {castleOpen && (
          <span className="rounded-full" style={{ width: 4, height: 4, background: 'var(--ink-crimson)', opacity: page === BOSSES.length ? 1 : 0.45,
            boxShadow: page === BOSSES.length ? '0 0 3px rgba(255,31,75,0.9)' : undefined }} />
        )}
      </div>
    </div>
  );
};
