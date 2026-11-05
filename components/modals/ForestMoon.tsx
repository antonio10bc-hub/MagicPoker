import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { animate, AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { clsx } from 'clsx';
import { Translations, useTranslations } from '@/lib/i18n';
import { playSfx } from '@/lib/sounds';
import { ForestState, Realm, REALM_GAIN, REALM_MARKS, REALMS, realmOpen } from '@/lib/forest';
import { TIER_INK, TIER_RGB } from '@/components/game/ForestFigure';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { ICONS } from '@/components/pixel/sprites';
import { IconButton } from '@/components/pixel/ui';
import { INK } from '@/theme/tokens';

// --- LA MARCA DEL BOSQUE: LA LUNA Y SUS TRES LUNAS ---
// En el bestiario, bajo tus noches. La marca es una luna ámbar que pasa de nueva a llena
// (llena en la marca de Renegados) con tu marca dentro. Los tres reinos son tres lunas
// pequeñas en su color (Pesadillas a la izquierda, Únicos abajo, Renegados a la derecha)
// sobre un anillo de órbita que pasa por detrás de la grande; se mecen despacio por él.
// Apagadas hasta abrirse con tu mejor marca (no se cierran); abiertas, laten en su color.
// Al abrir el bestiario la luna se llena desde 0. La (i) explica la marca en una ventanita.

const FULL = REALM_MARKS.renegade;
/** Dónde está cada reino en la órbita (grados: 0 derecha, 90 abajo, 180 izquierda) */
const SPOT: Record<Realm, number> = { nightmare: 180, unique: 90, renegade: 0 };
/** Lo que se mece cada luna por la órbita (grados) y en cuánto tiempo */
const SWAY = 9;
const SWAY_S = 7;
const STAGE_H = 128;
const CY = 52;
const ORBIT_RY = 43;

/** Una luna pequeña de un reino: abierta, llena en su color; cerrada, en sombra */
const RealmMoon = ({ realm, open, r }: { realm: Realm; open: boolean; r: number }) => {
  const id = useId();
  const color = TIER_INK[realm];
  const size = r * 2 + 2;
  return (
    <svg width={size} height={size} viewBox={`${-r - 1} ${-r - 1} ${size} ${size}`} className={clsx('block overflow-visible', open && 'anim-pulse-soft')}
      style={{ filter: open ? `drop-shadow(0 0 3px rgba(${TIER_RGB[realm]},0.95)) drop-shadow(0 0 8px rgba(${TIER_RGB[realm]},0.45))` : undefined }}>
      <defs>
        <radialGradient id={`${id}-lit`} cx="35%" cy="32%" r="75%">
          <stop offset="0" stopColor={INK.cream} />
          <stop offset="0.5" stopColor={color} />
          <stop offset="1" stopColor={INK.black} stopOpacity="0.3" />
        </radialGradient>
      </defs>
      {open ? (
        <>
          <circle r={r} fill={color} />
          <circle r={r} fill={`url(#${id}-lit)`} />
          <circle cx={r * 0.3} cy={r * 0.2} r={r * 0.22} fill={INK.black} opacity="0.18" />
          <circle cx={-r * 0.35} cy={r * 0.45} r={r * 0.14} fill={INK.black} opacity="0.15" />
        </>
      ) : (
        <>
          <circle r={r} fill={INK.slate} stroke={color} strokeOpacity="0.4" strokeWidth="1" />
          <circle cx={r * 0.3} cy={r * 0.2} r={r * 0.22} fill={INK.black} opacity="0.35" />
          <circle cx={-r * 0.35} cy={r * 0.45} r={r * 0.14} fill={INK.black} opacity="0.3" />
        </>
      )}
    </svg>
  );
};

/** La luna grande: la parte en sombra se retira según la marca (de nueva a llena) */
const MarkMoon = ({ fill, r }: { fill: number; r: number }) => {
  const id = useId();
  const size = r * 2 + 2;
  return (
    <svg width={size} height={size} viewBox={`${-r - 1} ${-r - 1} ${size} ${size}`} className="block overflow-visible"
      style={{ filter: `drop-shadow(0 0 ${3 + fill * 6}px rgba(255,194,51,${0.25 + fill * 0.55})) drop-shadow(0 0 ${8 + fill * 14}px rgba(255,194,51,${0.1 + fill * 0.3}))` }}>
      <defs>
        <radialGradient id={`${id}-lit`} cx="38%" cy="34%" r="72%">
          <stop offset="0" stopColor="#FFF6D8" />
          <stop offset="0.5" stopColor={INK.amber} />
          <stop offset="1" stopColor="#B87A0C" />
        </radialGradient>
        <clipPath id={`${id}-disc`}><circle r={r} /></clipPath>
      </defs>
      <circle r={r} fill={`url(#${id}-lit)`} />
      {/* Cráteres (se tapan con la sombra) */}
      <circle cx={-r * 0.32} cy={-r * 0.18} r={r * 0.2} fill="#B87A0C" opacity="0.45" />
      <circle cx={r * 0.28} cy={r * 0.36} r={r * 0.14} fill="#B87A0C" opacity="0.4" />
      <circle cx={r * 0.42} cy={-r * 0.42} r={r * 0.09} fill="#B87A0C" opacity="0.35" />
      <circle cx={-r * 0.1} cy={r * 0.55} r={r * 0.07} fill="#B87A0C" opacity="0.35" />
      {/* La sombra: un disco que se aparta hacia la derecha a medida que sube la marca */}
      <g clipPath={`url(#${id}-disc)`}>
        <circle cx={fill * 2 * r} r={r} fill="#141D1B" />
      </g>
      <circle r={r} fill="none" stroke={INK.amber} strokeOpacity={0.35 + fill * 0.3} strokeWidth="1" />
    </svg>
  );
};

/** La ventanita de la (i): qué suma cada duelo y qué abre cada cifra */
const MarkInfo = ({ onClose }: { onClose: () => void }) => {
  const t = useTranslations();
  const rows: [string, string, string][] = [
    [t.forest_mark_win_main, `+${REALM_GAIN.main}`, 'var(--ink-amber)'],
    ...REALMS.map(r => [t[`forest_mark_win_${r}` as keyof Translations], `+${REALM_GAIN[r]}`, TIER_INK[r]] as [string, string, string]),
    [t.forest_mark_loss, '−1', 'var(--ink-orange)'],
  ];
  return (
    <motion.div className="absolute inset-0 z-30 flex items-center justify-center p-[6px]" style={{ background: 'rgba(11,13,12,0.82)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={onClose}>
      <motion.div className="px-panel px-round w-full overflow-hidden" data-popover style={{ maxWidth: 220, boxShadow: 'inset 0 0 0 1px rgba(255,194,51,0.4), 0 6px 18px rgba(0,0,0,0.6)' }}
        initial={{ scale: 0.9, y: 6 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 4 }} transition={{ type: 'spring', stiffness: 480, damping: 30 }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-[5px] text-ink" style={{ background: 'var(--ink-amber)', height: 13, paddingTop: 2 }}>
          <span className="font-display" style={{ fontSize: 10, letterSpacing: 1 }}>{t.forest_marks}</span>
          <IconButton icon={ICONS.close} onClick={onClose} aria-label={t.aria_close} className="!w-[13px] !h-[11px]" />
        </div>
        <div className="p-[6px] flex flex-col gap-[5px] t-micro">
          <span style={{ color: 'var(--ink-mint)' }}>{t.forest_mark_intro}</span>
          <div className="flex flex-col">
            {rows.map(([label, value, color]) => (
              <div key={label} className="flex items-center justify-between py-[2px]" style={{ boxShadow: 'inset 0 -1px 0 0 rgba(185,207,200,0.08)' }}>
                <span>{label}</span>
                <span className="font-display" style={{ color, fontSize: 12, lineHeight: '12px' }}>{value}</span>
              </div>
            ))}
          </div>
          <span style={{ color: 'var(--ink-mint)' }}>{t.forest_mark_realms}</span>
          <div className="flex gap-[3px]">
            {REALMS.map(r => (
              <span key={r} className="flex-1 flex flex-col items-center rounded-[2px] py-[3px] font-display" style={{ background: 'rgba(11,13,12,0.5)', color: TIER_INK[r] }}>
                <span style={{ fontSize: 13, lineHeight: '13px' }}>{REALM_MARKS[r]}</span>
                <span style={{ fontSize: 7, lineHeight: '8px', letterSpacing: 0.5 }}>{t[`realm_${r}` as keyof Translations]}</span>
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

/** Una luna de reino en su sitio de la órbita, meciéndose, con su nombre y su cifra debajo */
const Satellite = ({ realm, open, cx, rx, r, still }: { realm: Realm; open: boolean; cx: number; rx: number; r: number; still: boolean }) => {
  const t = useTranslations();
  const at = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return { x: cx + Math.cos(a) * rx, y: CY + Math.sin(a) * ORBIT_RY };
  };
  const base = SPOT[realm];
  const [a, b, c] = [at(base - SWAY), at(base), at(base + SWAY)];
  const color = open ? TIER_INK[realm] : 'var(--ink-teal)';
  return (
    <motion.div className="absolute z-[3]" style={{ left: 0, top: 0 }}
      initial={false}
      animate={still ? { x: b.x, y: b.y } : { x: [b.x, c.x, b.x, a.x, b.x], y: [b.y, c.y, b.y, a.y, b.y] }}
      transition={still ? { duration: 0 } : { duration: SWAY_S, repeat: Infinity, ease: 'easeInOut', delay: REALMS.indexOf(realm) * 1.3 }}>
      {/* La luna, centrada en su punto de la órbita; el nombre y la cifra, colgando debajo */}
      <div className="absolute" style={{ left: -(r + 1), top: -(r + 1) }}><RealmMoon realm={realm} open={open} r={r} /></div>
      <span className={clsx('absolute font-display whitespace-nowrap text-center', open && realm === 'unique' && 'glow-gold')}
        style={{ top: r + 3, left: 0, transform: 'translateX(-50%)', color, fontSize: 7, lineHeight: '8px', letterSpacing: 0.5,
          textShadow: open ? `0 0 4px rgba(${TIER_RGB[realm]},0.7)` : undefined }}>
        {t[`realm_${realm}` as keyof Translations]}<br />{REALM_MARKS[realm]}
      </span>
    </motion.div>
  );
};

export const ForestMoon = ({ f }: { f: ForestState }) => {
  const t = useTranslations();
  const marks = f.marks ?? 0;
  const still = !!useReducedMotion();
  // Al abrir, la luna se llena desde 0 hasta tu marca (y la cifra cuenta)
  const [counted, setShown] = useState(0);
  const shown = still ? marks : counted;
  useEffect(() => {
    if (still) return;
    const c = animate(0, marks, {
      duration: 1.2, ease: [0.2, 0.7, 0.3, 1], delay: 0.25, onUpdate: setShown,
      onComplete: () => { if (marks > 0) playSfx('sparkle', 0.35); },
    });
    return () => c.stop();
  }, [marks, still]);
  // El escenario se adapta al ancho de la placa (en vertical es más estrecha)
  const stage = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(240);
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const read = () => setW(el.offsetWidth);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [info, setInfo] = useState(false);

  const narrow = w < 200;
  const moonR = narrow ? 22 : 29;
  const satR = narrow ? 8 : 9;
  const rx = Math.min(w / 2 - 22, 98);
  const cx = w / 2;
  const fill = Math.min(1, shown / FULL);
  const full = marks >= FULL;
  // El anillo de la órbita: la mitad de atrás va por detrás de la luna, la de delante por delante
  const ring = (half: 'back' | 'front') => (
    <svg className={clsx('absolute left-0 top-0 pointer-events-none', half === 'back' ? 'z-[1]' : 'z-[2]')} width={w} height={STAGE_H}>
      <path d={half === 'back'
        ? `M ${cx - rx} ${CY} A ${rx} ${ORBIT_RY} 0 0 1 ${cx + rx} ${CY}`
        : `M ${cx + rx} ${CY} A ${rx} ${ORBIT_RY} 0 0 1 ${cx - rx} ${CY}`}
        fill="none" stroke="rgba(255,194,51,1)" strokeOpacity={half === 'back' ? 0.18 : 0.32} strokeWidth="1" strokeDasharray="2 3" />
    </svg>
  );

  return (
    <div className="flex flex-col gap-[4px] pt-[12px]" style={{ boxShadow: 'inset 0 1px 0 0 rgba(255,194,51,0.18)' }}>
      <div className="flex items-center justify-between">
        <span className="font-display" style={{ color: 'var(--ink-amber)', fontSize: 9, letterSpacing: 1 }}>{t.forest_marks}</span>
        {/* (i): qué es la marca. Misma pieza que la del Castillo, en ámbar */}
        <button aria-label={t.aria_forest_mark_info} title={t.aria_forest_mark_info}
          className="relative z-10 flex items-center justify-center rounded-[2px] cursor-pointer transition-[filter] hover:brightness-125"
          style={{ width: 11, height: 11, background: 'var(--ink-amber)', boxShadow: '0 0 6px rgba(255,194,51,0.6)' }}
          onClick={() => { playSfx('open', 0.6); setInfo(true); }}>
          <PixelSprite sprite={ICONS.info} tint={INK.black} />
        </button>
      </div>
      <div ref={stage} className="relative" style={{ height: STAGE_H }} aria-label={`${t.forest_marks} ${marks}`}>
        {ring('back')}
        {/* La luna grande con tu marca dentro */}
        <div className="absolute z-[2]" style={{ left: cx, top: CY, transform: 'translate(-50%, -50%)' }}>
          <div className={clsx('relative', full && 'anim-pulse-soft')}>
            <span className="absolute rounded-full pointer-events-none" style={{ inset: -moonR * 0.6,
              background: `radial-gradient(circle, rgba(255,194,51,${0.12 + fill * 0.22}) 0%, transparent 65%)` }} />
            <MarkMoon fill={fill} r={moonR} />
            <span className="absolute inset-0 flex items-center justify-center font-display" style={{ fontSize: narrow ? 18 : 22, lineHeight: '18px', paddingTop: 2,
              color: 'var(--ink-cream)', textShadow: '0 0 2px var(--ink-black), 0 0 4px var(--ink-black), 0 0 8px rgba(11,13,12,0.8)' }}>
              {Math.round(shown)}
            </span>
          </div>
        </div>
        {ring('front')}
        {REALMS.map(r => <Satellite key={r} realm={r} open={realmOpen(f, r)} cx={cx} rx={rx} r={satR} still={still} />)}
      </div>
      <AnimatePresence>{info && <MarkInfo key="info" onClose={() => setInfo(false)} />}</AnimatePresence>
    </div>
  );
};
