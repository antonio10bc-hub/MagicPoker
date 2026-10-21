import { CSSProperties, ReactNode, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslations, Translations } from '@/lib/i18n';
import { useUiStore } from '@/store/useUiStore';
import { getCastle, getServerCastle, subscribeCastle } from '@/lib/castle';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { CASTLE_SPRITE } from '@/components/pixel/bosses';
import { HEART, SEAL_ICONS, STAR } from '@/components/pixel/sprites';
import { INK } from '@/theme/tokens';
import {
  BOSSES, bossLives, bossSeals, bossWins, isCastleUnlocked, currentBossIndex, getProgress, getServerProgress, isBossVisible,
  subscribeProgress, WINS_FOR_BACK,
} from '@/lib/bosses';
import { BossFigure } from '@/components/game/BossFigure';
import { CastleMap } from '@/components/game/CastleMap';
import { playSfx } from '@/lib/sounds';

// --- LISTA DE JEFES (menú) ---
// Una página por jefe, deslizable en horizontal (con imán) o con las flechas de los
// lados. Cada página tiene la misma estructura: etiqueta de estado arriba, la silueta,
// el nombre y una fila con lo que trae (vidas y sellos). Empieza en el jefe a derrotar
// (o en el Castillo, si está abierto). Los futuros salen apagados y sin nombre.

/** Etiqueta de estado: pastilla con el color de lo que significa */
const Pill = ({ children, tone }: { children: ReactNode; tone: 'hot' | 'muted' | 'castle' }) => {
  const style: Record<typeof tone, CSSProperties> = {
    hot: { background: 'var(--ink-orange)', color: 'var(--ink-black)', boxShadow: '0 0 6px rgba(255,74,28,0.55)' },
    muted: { background: 'rgba(30,42,40,0.9)', color: 'var(--ink-mint)', boxShadow: 'inset 0 0 0 1px rgba(185,207,200,0.12)' },
    castle: { background: 'var(--ink-crimson)', color: 'var(--ink-black)', boxShadow: '0 0 6px rgba(255,31,75,0.6)' },
  };
  return (
    <span className="font-display px-[5px] rounded-[2px] whitespace-nowrap" style={{ fontSize: 9, lineHeight: '11px', height: 11, paddingTop: 1, ...style[tone] }}>
      {children}
    </span>
  );
};

/** Victorias contra un jefe: 5 estrellas pequeñas, encendidas las ganadas (con 5, doradas) */
const Stars = ({ lit }: { lit: number }) => (
  <span className="flex items-center gap-[2px] h-[11px]" aria-label={`${lit}/${WINS_FOR_BACK}`}>
    {Array.from({ length: WINS_FOR_BACK }, (_, i) => (
      <PixelSprite key={i} sprite={STAR} tint={i < lit ? (lit >= WINS_FOR_BACK ? INK.gold : INK.orange) : INK.slate}
        className={i < lit ? (lit >= WINS_FOR_BACK ? 'bloom-gold-shape' : 'bloom-shape') : undefined} />
    ))}
  </span>
);

/** Flecha de navegación (izquierda o derecha) */
const Arrow = ({ dir, onClick }: { dir: -1 | 1; onClick: () => void }) => (
  <button aria-label={dir < 0 ? 'previous boss' : 'next boss'} onClick={onClick}
    className="absolute z-10 flex items-center justify-center cursor-pointer opacity-60 hover:opacity-100"
    style={{ top: '42%', [dir < 0 ? 'left' : 'right']: 0, width: 18, height: 26, transform: dir < 0 ? 'scaleX(-1)' : undefined }}>
    <PixelSprite sprite={SEAL_ICONS.shift} tint={INK.cream} />
  </button>
);

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

  // Al abrir el menú (o al vencer a uno) se coloca en el jefe actual
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollLeft = start * width;
    setMenuBoss(start);
  }, [start, width, setMenuBoss]);

  // El jefe secreto no sale hasta que lo alcanzas
  const shown = BOSSES.filter((_, i) => isBossVisible(i, progress));
  const pages = shown.length + (castleOpen ? 1 : 0);
  // Silueta: lo que queda tras la etiqueta, el nombre y la fila de datos
  const figureH = Math.max(40, Math.min(96, height - 58));
  const go = (dir: -1 | 1) => {
    const next = Math.max(0, Math.min(pages - 1, page + dir));
    ref.current?.scrollTo({ left: next * width, behavior: 'smooth' });
  };
  const total = String(BOSSES.length);

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
          const wins = Math.min(bossWins(i, progress), WINS_FOR_BACK);
          const isCurrent = i === current;
          const locked = i > current;
          const seals = Array.from(new Set(bossSeals(boss)));
          return (
            <div key={boss.id} className="shrink-0 flex flex-col items-center justify-center gap-[4px]" style={{ width, height, scrollSnapAlign: 'center' }}>
              {isCurrent && !beaten
                ? <Pill tone="hot">{boss.secret ? t.secret_boss : t.next_rival}</Pill>
                : beaten
                  ? <Stars lit={wins} />
                  : <Pill tone="muted">{t.boss_n.replace('{n}', String(i + 1)).replace('{total}', total)}</Pill>}
              <div className={isCurrent ? 'anim-breathe' : undefined} style={{ opacity: beaten && !isCurrent ? 0.6 : 1 }}>
                <BossFigure id={boss.id} height={figureH} dim={locked} />
              </div>
              <span className="text-outline" style={{ fontSize: 13, lineHeight: '13px' }}>
                {locked ? '???' : t[`boss_${boss.id}` as keyof Translations]}
              </span>
              {/* Lo que trae: vidas y sellos */}
              <span className="flex items-center gap-[5px] h-[9px]" style={{ opacity: locked ? 0 : 1 }}>
                <span className="flex items-center gap-[1px]">
                  <PixelSprite sprite={HEART} tint={INK.orange} />
                  <span className="font-display t-micro" style={{ color: 'var(--ink-cream)' }}>×{bossLives(boss)}</span>
                </span>
                {seals.slice(0, 10).map(s => <PixelSprite key={s} sprite={SEAL_ICONS[s]} tint={INK.volt} />)}
              </span>
            </div>
          );
        })}
        {/* El Castillo: "un jefe más" al final de la lista, en rojo eléctrico */}
        {castleOpen && (
          <div className="shrink-0 flex flex-col items-center justify-center gap-[4px]" style={{ width, height, scrollSnapAlign: 'center' }}>
            <Pill tone="castle">
              {castle.run ? t.castle_floor.replace('{n}', String(castle.run.stage + 1)).replace('{total}', total)
                : t.castle_best.replace('{n}', String(castle.best)).replace('{total}', total)}
            </Pill>
            <div className="anim-breathe">
              <PixelSprite sprite={CASTLE_SPRITE} tint={INK.crimson} className="bloom-crimson-shape"
                style={{ width: Math.round(figureH * 32 / 41), height: figureH }} />
            </div>
            <span className="text-outline glow-crimson" style={{ fontSize: 13, lineHeight: '13px', color: 'var(--ink-crimson)' }}>{t.castle_title}</span>
            {/* Con una subida a medias, su mapa; si no, la frase del Castillo */}
            {castle.run
              ? <CastleMap stage={castle.run.stage} chestPending={!!castle.run.chest} />
              : <span className="t-micro text-center px-[18px]" style={{ color: 'var(--ink-mint)' }}>
                {castle.conquered > 0 ? t.ch_record.replace('{n}', String(castle.bestChallenges ?? 0)) : t.castle_tagline}
              </span>}
          </div>
        )}
      </div>
      {page > 0 && <Arrow dir={-1} onClick={() => go(-1)} />}
      {page < pages - 1 && <Arrow dir={1} onClick={() => go(1)} />}
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
