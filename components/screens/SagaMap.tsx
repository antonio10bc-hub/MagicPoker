import { CSSProperties, ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Translations, useTranslations } from '@/lib/i18n';
import { useUiStore } from '@/store/useUiStore';
import { getCastle, getServerCastle, subscribeCastle } from '@/lib/castle';
import {
  BOSSES, bossLives, bossSeals, bossWins, getProgress, getServerProgress, subscribeProgress, WINS_FOR_BACK,
} from '@/lib/bosses';
import { getMapSeen, revealSteps, RevealStep, setMapSeen } from '@/lib/mapReveal';
import { haptic, playSfx } from '@/lib/sounds';
import { INK } from '@/theme/tokens';
import { Rect } from '@/theme/layout';
import { PixelSprite, spriteSize } from '@/components/pixel/PixelSprite';
import { CASTLE_ART, spriteAura } from '@/components/pixel/bosses';
import { HEART, SEAL_ICONS, STAR } from '@/components/pixel/sprites';
import { FLOOR_TILE, STONE_FACE_TILE, patternUri } from '@/components/pixel/patterns';
import { BossFigure } from '@/components/game/BossFigure';
import { CastleMap } from '@/components/game/CastleMap';

// --- MAPA DE JEFES (menú) ---
// Un camino continuo en vertical, de abajo arriba: cada jefe de pie sobre su pequeño
// tapete, unidos por un sendero de puntos (crema lo recorrido, pizarra lo que falta).
// Arriba del todo, entre la niebla, el Castillo. Lo que aún no conoces no se ve: el
// Soberano y el Castillo esperan ocultos en la niebla hasta que los alcanzas.
// Tocar un jefe lo elige (la acción principal del menú juega contra él).
//
// Revelaciones: al volver al menú tras vencer a un jefe nuevo, se bloquea el input y se
// cuenta por fases, con la cámara siguiendo: el jefe vencido recibe su sello
// "¡VENCIDO!", el sendero avanza y el siguiente se enciende. Si el que llega es el
// secreto: aviso "¡JEFE SECRETO ACTIVADO!" y el Soberano cae de la niebla a su sitio. Si
// era el Soberano: aviso y el Castillo se alza. Al terminar vuelve el control.

/** Selección del Castillo: el índice después del último jefe */
export const CASTLE_INDEX = BOSSES.length;

const STEP = 96;
const BOTTOM = 110;
const CASTLE_GAP = 150;
/** Sitio sobre el Castillo para su pastilla y la cabecera del menú */
const TOP = 80;
const CASTLE_H = 104;

type Phase = 'idle' | 'focus' | 'beaten' | 'path' | 'next' | 'secret' | 'summon' | 'castle' | 'rise';
/** Momentos de cada fase (ms desde que empieza el paso) */
const T = { beaten: 750, path: 2000, arrive: 3100, nextDone: 4400, summon: 5200, secretDone: 7400, rise: 5000, castleDone: 8000 };

const geometry = (w: number) => {
  const n = BOSSES.length;
  const castle = { x: Math.round(w / 2), y: TOP + CASTLE_H };
  const contentH = castle.y + CASTLE_GAP + (n - 1) * STEP + BOTTOM;
  const amp = Math.min(54, Math.round(w * 0.24));
  const nodes = BOSSES.map((_, i) => ({ x: Math.round(w / 2 + amp * Math.sin(i * 1.15 + 0.4)), y: contentH - BOTTOM - i * STEP }));
  return { contentH, nodes, castle };
};

/** Puntos del sendero entre dos sitios (curva suave, un punto cada 6 px) */
const trail = (a: { x: number; y: number }, b: { x: number; y: number }, endPad = 16) => {
  const c1 = { x: a.x, y: a.y - (a.y - b.y) * 0.55 };
  const c2 = { x: b.x, y: b.y + (a.y - b.y) * 0.55 };
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const count = Math.max(4, Math.floor(len / 6));
  const pts: { x: number; y: number }[] = [];
  // Ni sobre el tapete de salida ni sobre el de llegada (ni sobre el texto del Castillo)
  for (let i = 1; i < count; i++) {
    const t = i / count;
    const u = 1 - t;
    pts.push({
      x: Math.round(u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x),
      y: Math.round(u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y),
    });
  }
  return pts.filter(p => Math.hypot(p.x - a.x, p.y - a.y) > 18 && Math.hypot(p.x - b.x, p.y - b.y) > endPad);
};

const Trail = ({ a, b, lit, drawing, endPad }: { a: { x: number; y: number }; b: { x: number; y: number }; lit: boolean; drawing?: boolean; endPad?: number }) => {
  const pts = useMemo(() => trail(a, b, endPad), [a, b, endPad]);
  return (
    <>
      {pts.map((p, i) => (
        <motion.span key={i} className="absolute pointer-events-none" style={{ left: p.x - 1, top: p.y - 1, width: 2, height: 2,
          background: lit ? 'var(--ink-cream)' : 'var(--ink-slate)', boxShadow: lit ? '0 0 3px rgba(237,235,224,0.6)' : undefined }}
          initial={drawing ? { opacity: 0, scale: 2.5 } : false} animate={{ opacity: lit ? 0.9 : 0.6, scale: 1 }}
          transition={drawing ? { delay: (i / pts.length) * 0.9, duration: 0.2 } : undefined} />
      ))}
    </>
  );
};

/** Pequeño tapete sobre el que está cada jefe (como el de la partida, en miniatura) */
const Plinth = ({ lit, castle }: { lit: boolean; castle?: boolean }) => (
  <div className="absolute pointer-events-none" style={{ left: -24, top: -6, width: 48, height: 14 }}>
    {/* Niebla (o brasa carmesí en el Castillo) a ras de suelo */}
    <div className="absolute" style={{ left: -16, top: -14, width: 80, height: 34,
      background: castle ? 'radial-gradient(ellipse 50% 50% at 50% 55%, rgba(255,31,75,0.3) 0%, transparent 70%)'
        : `radial-gradient(ellipse 50% 50% at 50% 55%, rgba(237,235,224,${lit ? 0.26 : 0.1}) 0%, rgba(111,143,90,0.04) 55%, transparent 72%)` }} />
    <div className="absolute inset-x-0" style={{ top: 6, height: 8, borderRadius: '0 0 6px 6px', backgroundImage: patternUri('stone-face', STONE_FACE_TILE), backgroundSize: 12 }} />
    <div className="absolute inset-x-0 top-0" style={{ height: 9, borderRadius: 6, backgroundImage: patternUri('floor', FLOOR_TILE), backgroundSize: 16,
      boxShadow: 'inset 0 0 0 1px rgba(11,13,12,0.6)' }} />
  </div>
);

/** Etiqueta de estado: pastilla con el color de lo que significa */
const Pill = ({ children, tone, style }: { children: ReactNode; tone: 'hot' | 'muted' | 'castle'; style?: CSSProperties }) => {
  const tones: Record<typeof tone, CSSProperties> = {
    hot: { background: 'var(--ink-orange)', color: 'var(--ink-black)', boxShadow: '0 0 6px rgba(255,74,28,0.55)' },
    muted: { background: 'rgba(30,42,40,0.9)', color: 'var(--ink-mint)', boxShadow: 'inset 0 0 0 1px rgba(185,207,200,0.12)' },
    castle: { background: 'var(--ink-crimson)', color: 'var(--ink-black)', boxShadow: '0 0 6px rgba(255,31,75,0.6)' },
  };
  return (
    <span className="font-display px-[5px] rounded-[2px] whitespace-nowrap" style={{ fontSize: 9, lineHeight: '11px', height: 11, paddingTop: 1, ...tones[tone], ...style }}>
      {children}
    </span>
  );
};

/** Victorias contra un jefe: 5 estrellas, encendidas las ganadas (con 5, doradas) */
const Stars = ({ lit, pop }: { lit: number; pop?: boolean }) => (
  <span className="flex items-center gap-[2px] h-[11px]" aria-label={`${lit}/${WINS_FOR_BACK}`}>
    {Array.from({ length: WINS_FOR_BACK }, (_, i) => (
      <motion.span key={i} initial={pop && i < lit ? { scale: 0, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.35 + i * 0.08, type: 'spring', stiffness: 500, damping: 14 }}>
        <PixelSprite sprite={STAR} tint={i < lit ? (lit >= WINS_FOR_BACK ? INK.gold : INK.orange) : INK.slate}
          className={i < lit ? (lit >= WINS_FOR_BACK ? 'bloom-gold-shape' : 'bloom-shape') : undefined} />
      </motion.span>
    ))}
  </span>
);

/** El Castillo: silueta negra con aura carmesí, ventanas encendidas y un resplandor detrás */
const CastleArt = ({ height }: { height: number }) => {
  const { width: w, height: h } = spriteSize(CASTLE_ART.body);
  const size = { width: (w * height) / h, height };
  const layer: CSSProperties = { position: 'absolute', inset: 0, ...size };
  return (
    <div className="relative" style={size}>
      <div className="absolute pointer-events-none anim-pulse-soft" style={{ left: '-60%', top: '-20%', width: '220%', height: '140%',
        background: 'radial-gradient(ellipse 50% 50% at 50% 55%, rgba(255,31,75,0.42) 0%, rgba(255,31,75,0.14) 42%, transparent 70%)' }} />
      <PixelSprite sprite={spriteAura(CASTLE_ART.body, 2, 'castle')} tint={INK.crimson} className="anim-flicker bloom-crimson-shape" style={layer} />
      <PixelSprite sprite={CASTLE_ART.body} tint={INK.black} style={layer} />
      <PixelSprite sprite={CASTLE_ART.windows} tint={INK.crimson} className="bloom-crimson-shape anim-pulse-soft" style={layer} />
    </div>
  );
};

/** Sello que cae sobre el jefe recién vencido */
const BeatenStamp = ({ text }: { text: string }) => (
  <motion.span className="absolute font-display whitespace-nowrap px-[6px] rounded-[3px] pointer-events-none z-30"
    style={{ left: 0, top: -30, fontSize: 14, lineHeight: '16px', paddingTop: 2, color: 'var(--ink-black)', background: 'var(--ink-orange)',
      boxShadow: '0 0 0 2px var(--ink-black), 0 0 0 3px var(--ink-orange), 0 0 14px 3px rgba(255,74,28,0.6)', x: '-50%' }}
    initial={{ scale: 3.2, rotate: -24, opacity: 0 }} animate={{ scale: 1, rotate: -8, opacity: 1 }}
    exit={{ opacity: 0, transition: { duration: 0.3 } }}
    transition={{ type: 'spring', stiffness: 520, damping: 16 }}>
    {text}
  </motion.span>
);

/** Aviso grande en el centro (jefe secreto, Castillo): oscurece el mapa y lo dice claro */
const Announce = ({ title, sub, tone }: { title: string; sub: string; tone: 'gold' | 'crimson' }) => {
  const rgb = tone === 'gold' ? '232,182,74' : '255,31,75';
  return (
    <motion.div key={title} className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-[6px] px-[14px] pointer-events-none"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.6 } }} transition={{ duration: 0.4 }}
      style={{ background: `radial-gradient(ellipse 70% 40% at 50% 50%, rgba(${rgb},0.16) 0%, rgba(11,13,12,0.86) 70%)` }}>
      <motion.span className="font-display text-center" style={{ fontSize: 17, lineHeight: '18px', letterSpacing: 1, color: tone === 'gold' ? 'var(--ink-gold)' : 'var(--ink-crimson)',
        textShadow: `0 0 8px rgba(${rgb},0.9), 0 0 22px rgba(${rgb},0.5)` }}
        initial={{ scale: 2.4, opacity: 0, filter: 'blur(3px)' }} animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
        transition={{ type: 'spring', stiffness: 380, damping: 15, delay: 0.15 }}>
        {title}
      </motion.span>
      <motion.span className="t-micro text-center" style={{ color: 'var(--ink-mint)' }}
        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.5 }}>
        {sub}
      </motion.span>
    </motion.div>
  );
};

export const SagaMap = ({ rect, safeTop = 0, safeBottom = 0, onRevealing }: {
  /** Zona del escenario que ocupa el mapa */
  rect: Rect;
  /** Lo que tapan arriba y abajo la cabecera y la acción principal (para centrar bien) */
  safeTop?: number;
  safeBottom?: number;
  /** Mientras se cuenta algo nuevo (input bloqueado) */
  onRevealing?: (on: boolean) => void;
}) => {
  const t = useTranslations();
  const progress = useSyncExternalStore(subscribeProgress, getProgress, getServerProgress);
  const castle = useSyncExternalStore(subscribeCastle, getCastle, getServerCastle);
  const setMenuBoss = useUiStore(s => s.setMenuBoss);
  const selected = useUiStore(s => s.menuBoss);
  const scroller = useRef<HTMLDivElement>(null);
  const { contentH, nodes, castle: castlePt } = useMemo(() => geometry(rect.w), [rect.w]);

  // Lo que el mapa enseña: hasta dónde ya se contó, y lo nuevo por contar
  // (se decide al montar en el navegador: en el servidor no hay progreso)
  const [steps, setSteps] = useState<RevealStep[]>([]);
  const [revealed, setRevealed] = useState<number | null>(null);
  const shown = revealed ?? progress.defeated;
  const [phase, setPhase] = useState<Phase>('idle');
  const [step, setStep] = useState<RevealStep | null>(null);
  const revealing = steps.length > 0;

  const current = Math.min(shown, BOSSES.length - 1);
  const castleOpen = shown >= BOSSES.length;

  /** Centra la cámara en un sitio (en la zona que no tapa la interfaz) */
  const lookAt = (y: number, smooth = true) => {
    const el = scroller.current;
    if (!el) return;
    const visible = rect.h - safeTop - safeBottom;
    const top = Math.max(0, Math.min(contentH - rect.h, y - safeTop - visible * 0.58));
    if (smooth) el.scrollTo({ top, behavior: 'smooth' });
    else el.scrollTop = top;
  };
  const yOf = (i: number) => (i >= CASTLE_INDEX ? castlePt.y : nodes[i].y);

  // Al abrir: la cámara en el jefe a derrotar (o en el Castillo); con algo por contar,
  // en el último vencido de antes
  useLayoutEffect(() => {
    const { defeated } = getProgress();
    const seen = getMapSeen(defeated);
    const pending = revealSteps(seen, defeated);
    if (pending.length) {
      setSteps(pending);
      setRevealed(seen);
      lookAt(yOf(pending[0].beaten), false);
      setMenuBoss(Math.min(seen, BOSSES.length - 1));
    } else {
      const home = defeated >= BOSSES.length ? CASTLE_INDEX : defeated;
      lookAt(yOf(home), false);
      setMenuBoss(home);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect.w, rect.h]);

  // Las revelaciones, paso a paso, con la cámara siguiendo
  useEffect(() => {
    if (!steps.length) return;
    const setShown = setRevealed;
    onRevealing?.(true);
    useUiStore.getState().setCinematic(true);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    let clock = 400;
    steps.forEach(s => {
      const k = s.beaten;
      const next = s.then === 'castle' ? CASTLE_INDEX : k + 1;
      at(clock, () => { setStep(s); setPhase('focus'); lookAt(yOf(k)); });
      at(clock + T.beaten, () => { setPhase('beaten'); setShown(k + 1); playSfx('crush', 0.6, 1.3); playSfx('pop', 0.8, 1.1); haptic('stamp'); });
      at(clock + T.path, () => { setPhase('path'); playSfx('whoosh', 0.5, 1.2); lookAt((yOf(k) + yOf(next)) / 2); });
      if (s.then === 'next') {
        at(clock + T.arrive, () => { setPhase('next'); lookAt(yOf(next)); playSfx('flip', 0.7, 0.9); playSfx('sparkle', 0.6, 1.2); haptic('stamp'); });
        clock += T.nextDone;
      } else if (s.then === 'secret') {
        at(clock + T.arrive, () => { setPhase('secret'); lookAt(yOf(next)); playSfx('zap', 0.8, 0.5); playSfx('heartbeat', 0.8); haptic('lifeLost'); });
        at(clock + T.summon, () => { setPhase('summon'); playSfx('wipe', 0.7, 0.8); playSfx('sparkle', 0.8, 0.7); haptic('win'); });
        clock += T.secretDone;
      } else {
        at(clock + T.arrive, () => { setPhase('castle'); playSfx('crush', 1, 0.5); haptic('lifeLost'); });
        at(clock + T.rise, () => { setPhase('rise'); lookAt(yOf(CASTLE_INDEX)); playSfx('wipe', 0.8, 0.6); });
        at(clock + T.rise + 900, () => { playSfx('crush', 0.8, 0.4); haptic('win'); });
        at(clock + T.rise + 1700, () => playSfx('sparkle', 0.8, 0.8));
        clock += T.castleDone;
      }
    });
    // Fin: se anota, se elige lo nuevo y vuelve el control
    at(clock, () => {
      const last = steps[steps.length - 1];
      setMapSeen(last.beaten + 1);
      setPhase('idle');
      setStep(null);
      setSteps([]);
      setRevealed(null);
      setMenuBoss(last.then === 'castle' ? CASTLE_INDEX : last.beaten + 1);
      useUiStore.getState().setCinematic(false);
      onRevealing?.(false);
    });
    return () => {
      timers.forEach(clearTimeout);
      useUiStore.getState().setCinematic(false);
      onRevealing?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps]);

  // Durante una revelación: qué sigue oculto o apagado hasta su fase
  const target = step ? (step.then === 'castle' ? CASTLE_INDEX : step.beaten + 1) : -1;
  const before = (p: Phase[]) => step !== null && p.includes(phase);
  const pendingLocked = (i: number) => i === target && before(['focus', 'beaten', 'path']);
  const hidden = (i: number) => (i === target && step?.then === 'secret' && before(['focus', 'beaten', 'path', 'secret']));
  const castleVisible = castleOpen && !(target === CASTLE_INDEX && before(['focus', 'beaten', 'path', 'castle']));
  const trailLit = (i: number) => i < shown && !(step?.beaten === i && before(['focus', 'beaten']));
  const visible = (i: number) => (!BOSSES[i].secret || shown >= i) && !hidden(i);
  // La niebla tapa todo lo que está por encima de lo último que conoces
  const topKnown = castleVisible ? castlePt.y - CASTLE_H - 40
    : nodes[[...BOSSES.keys()].reverse().find(i => visible(i)) ?? 0].y - 70;

  const pick = (i: number) => {
    if (revealing) return;
    playSfx('select', 0.5, 1.1);
    setMenuBoss(i);
  };
  const total = String(BOSSES.length);
  const figureH = 42;

  return (
    <div className="absolute z-10" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
      <div ref={scroller} className="no-scrollbar absolute inset-0 overflow-y-auto overflow-x-hidden"
        style={{ touchAction: revealing ? 'none' : 'pan-y', overflowY: revealing ? 'hidden' : 'auto', overscrollBehavior: 'contain' }}>
        <div className="relative" style={{ height: contentH, width: rect.w }}>
          {/* Bancos de niebla que se arrastran despacio por la ladera */}
          {[0.15, 0.38, 0.62, 0.85].map((f, i) => (
            <motion.div key={i} className="absolute pointer-events-none" style={{ top: contentH * f - 40, left: -rect.w * 0.3, width: rect.w * 1.6, height: 80,
              background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(185,207,200,0.07) 0%, transparent 70%)' }}
              animate={{ x: [i % 2 ? -18 : 18, i % 2 ? 18 : -18] }} transition={{ duration: 9 + i * 2, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }} />
          ))}

          {/* El sendero */}
          {nodes.slice(1).map((b, n) => {
            const i = n + 1;
            const drawing = step?.beaten === n && phase === 'path';
            // Al secreto, solo cuando ya asoma (o mientras se dibuja hacia la niebla)
            if (!visible(i) && !drawing) return null;
            return <Trail key={i} a={nodes[n]} b={b} lit={trailLit(n)} drawing={drawing} />;
          })}
          {(castleVisible || (step?.then === 'castle' && phase === 'path')) && (
            <Trail a={nodes[BOSSES.length - 1]} b={castlePt} endPad={46} lit={castleVisible || phase === 'path'} drawing={step?.then === 'castle' && phase === 'path'} />
          )}

          {/* Los jefes */}
          {BOSSES.map((boss, i) => {
            if (!visible(i)) return null;
            const p = nodes[i];
            const beaten = i < shown;
            const locked = i > current || pendingLocked(i);
            const isCurrent = i === current && !beaten && !locked;
            const isSel = selected === i && !revealing;
            const wins = Math.min(bossWins(i, progress), WINS_FOR_BACK);
            const justBeaten = step?.beaten === i && phase !== 'focus';
            const arriving = i === target && (phase === 'next' || phase === 'summon');
            const seals = Array.from(new Set(bossSeals(boss)));
            return (
              <div key={boss.id} className="absolute" style={{ left: p.x, top: p.y, width: 0, height: 0, zIndex: isSel ? 5 : 2 }}>
                <Plinth lit={beaten || isCurrent} />
                {/* El Soberano: resplandor de oro detrás */}
                {boss.secret && (
                  <span className="absolute pointer-events-none anim-pulse-soft" style={{ left: -45, top: -figureH - 30, width: 90, height: figureH + 40,
                    background: 'radial-gradient(ellipse 50% 50% at 50% 55%, rgba(232,182,74,0.35) 0%, rgba(232,182,74,0.1) 45%, transparent 70%)' }} />
                )}
                {/* Elegido: anillo crema bajo los pies */}
                {isSel && (
                  <span className="absolute rounded-[50%] anim-pulse-soft pointer-events-none" style={{ left: -30, top: -9, width: 60, height: 18,
                    boxShadow: '0 0 0 1px var(--ink-cream), 0 0 8px 1px rgba(237,235,224,0.45)' }} />
                )}
                {/* Silueta de pie sobre el tapete */}
                <motion.div className="absolute" style={{ left: 0, bottom: 2, x: '-50%', transformOrigin: '50% 100%' }}
                  initial={arriving && step?.then === 'secret' ? { y: -180, scale: 2.2, opacity: 0, filter: 'brightness(3)' } : false}
                  animate={arriving && step?.then === 'secret'
                    ? { y: [-180, 0, 0], scale: [2.2, 1.25, 1], opacity: [0, 1, 1], filter: ['brightness(3)', 'brightness(2)', 'brightness(1)'] }
                    : arriving ? { scale: [1, 1.25, 1], filter: ['brightness(1)', 'brightness(2.6)', 'brightness(1)'] }
                      : justBeaten && phase === 'beaten' ? { x: ['-50%', '-56%', '-44%', '-50%'] } : {}}
                  transition={arriving && step?.then === 'secret' ? { duration: 1.6, times: [0, 0.55, 1], ease: 'easeOut' } : { duration: 0.6 }}>
                  <div className={isCurrent ? 'anim-breathe' : undefined} style={{ opacity: beaten && !isSel ? 0.62 : 1 }}>
                    <BossFigure id={boss.id} height={boss.secret ? figureH + 8 : figureH} dim={locked} />
                  </div>
                </motion.div>
                {/* Onda al llegar */}
                {arriving && (
                  <motion.span className="absolute rounded-full pointer-events-none" style={{ left: -30, top: -50, width: 60, height: 60,
                    boxShadow: boss.secret ? '0 0 0 2px rgba(232,182,74,0.95), 0 0 14px 4px rgba(255,31,75,0.5)' : '0 0 0 2px rgba(255,74,28,0.9), 0 0 12px 3px rgba(255,74,28,0.4)' }}
                    initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: [0.2, 1.8], opacity: [0, 1, 0] }}
                    transition={{ delay: boss.secret ? 0.85 : 0.15, duration: 0.9, ease: 'easeOut' }} />
                )}
                {/* El sello de vencido cae sobre la figura */}
                <AnimatePresence>{justBeaten && phase === 'beaten' && <BeatenStamp text={t.map_beaten} />}</AnimatePresence>
                {/* Arriba: estado (o sus estrellas si ya lo venciste) */}
                <div className="absolute flex justify-center" style={{ left: -50, width: 100, top: -(figureH + (boss.secret ? 22 : 14)) }}>
                  <AnimatePresence mode="wait">
                    {justBeaten && phase === 'beaten' ? null
                      : beaten ? <Stars key="stars" lit={wins} pop={justBeaten} />
                        : isCurrent ? (
                          <motion.span key="hot" initial={arriving ? { scale: 0, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: arriving ? 0.35 : 0, type: 'spring', stiffness: 500, damping: 14 }}>
                            <Pill tone="hot">{arriving && !boss.secret ? t.map_new_rival : boss.secret ? t.secret_boss : t.next_rival}</Pill>
                          </motion.span>
                        ) : isSel ? <Pill key="n" tone="muted">{t.boss_n.replace('{n}', String(i + 1)).replace('{total}', total)}</Pill> : null}
                  </AnimatePresence>
                </div>
                {/* Debajo: el nombre y, si está elegido, lo que trae */}
                <div className="absolute flex flex-col items-center gap-[2px]" style={{ left: -60, width: 120, top: 10 }}>
                  <span className="text-outline whitespace-nowrap" style={{ fontSize: 11, lineHeight: '11px', opacity: locked ? 0.5 : beaten && !isSel ? 0.7 : 1,
                    color: boss.secret && !locked ? 'var(--ink-gold)' : undefined }}>
                    {locked ? '???' : t[`boss_${boss.id}` as keyof Translations]}
                  </span>
                  {isSel && !locked && (
                    <span className="flex items-center gap-[4px] h-[9px]">
                      <span className="flex items-center gap-[1px]">
                        <PixelSprite sprite={HEART} tint={INK.orange} />
                        <span className="font-display t-micro" style={{ color: 'var(--ink-cream)' }}>×{bossLives(boss)}</span>
                      </span>
                      {seals.length > 4
                        ? <span className="flex items-center gap-[1px]"><PixelSprite sprite={SEAL_ICONS[seals[0]]} tint={INK.volt} />
                          <span className="font-display t-micro" style={{ color: 'var(--ink-volt)' }}>×{seals.length}</span></span>
                        : seals.map(s => <PixelSprite key={s} sprite={SEAL_ICONS[s]} tint={INK.volt} />)}
                    </span>
                  )}
                </div>
                {/* Zona de toque: la figura, su tapete y su nombre */}
                <button aria-label={`map boss ${i + 1}`} onClick={() => pick(i)} className="absolute cursor-pointer"
                  style={{ left: -36, top: -figureH - 10, width: 72, height: figureH + 34 }} />
              </div>
            );
          })}

          {/* Arriba del todo: el Castillo */}
          {castleVisible && (
            <div className="absolute" style={{ left: castlePt.x, top: castlePt.y, width: 0, height: 0, zIndex: 3 }}>
              <button aria-label="map castle" onClick={() => pick(CASTLE_INDEX)} className="absolute cursor-pointer"
                style={{ left: -50, top: -CASTLE_H, width: 100, height: CASTLE_H + 24 }} />
              <Plinth lit castle />
              {selected === CASTLE_INDEX && !revealing && (
                <span className="absolute rounded-[50%] anim-pulse-soft pointer-events-none" style={{ left: -44, top: -10, width: 88, height: 20,
                  boxShadow: '0 0 0 1px var(--ink-crimson), 0 0 10px 2px rgba(255,31,75,0.5)' }} />
              )}
              <motion.div className="absolute" style={{ left: 0, bottom: 2, x: '-50%', transformOrigin: '50% 100%' }}
                initial={phase === 'rise' ? { y: 60, scaleY: 0.2, opacity: 0, filter: 'brightness(0)' } : false}
                animate={{ y: 0, scaleY: 1, opacity: 1, filter: 'brightness(1)', x: phase === 'rise' ? ['-50%', '-53%', '-47%', '-52%', '-48%', '-50%'] : '-50%' }}
                transition={{ duration: 1.9, ease: 'easeOut' }}>
                <CastleArt height={CASTLE_H} />
              </motion.div>
              {phase === 'rise' && (
                <motion.span className="absolute pointer-events-none" style={{ left: -90, top: -CASTLE_H - 30, width: 180, height: CASTLE_H + 60,
                  background: 'radial-gradient(ellipse 50% 50% at 50% 60%, rgba(255,31,75,0.85) 0%, rgba(255,31,75,0.3) 40%, transparent 70%)' }}
                  initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 0.55, 0] }} transition={{ duration: 2.2, times: [0, 0.75, 0.82, 1] }} />
              )}
              <div className="absolute flex justify-center" style={{ left: -60, width: 120, top: -CASTLE_H - 16 }}>
                <motion.span initial={phase === 'rise' ? { scale: 0, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 1.9, type: 'spring', stiffness: 500, damping: 14 }}>
                  <Pill tone="castle">
                    {castle.run ? t.castle_floor.replace('{n}', String(castle.run.stage + 1)).replace('{total}', total)
                      : t.castle_best.replace('{n}', String(castle.best)).replace('{total}', total)}
                  </Pill>
                </motion.span>
              </div>
              <div className="absolute flex flex-col items-center gap-[3px]" style={{ left: -80, width: 160, top: 16 }}>
                <span className="font-display glow-crimson" style={{ fontSize: 13, lineHeight: '13px', letterSpacing: 2, color: 'var(--ink-crimson)' }}>{t.castle_title}</span>
                {/* Con una subida a medias, su mapa; si no, la frase del Castillo */}
                {castle.run
                  ? <CastleMap stage={castle.run.stage} chestPending={!!castle.run.chest} />
                  : <span className="t-micro text-center" style={{ color: 'var(--ink-mint)' }}>
                    {castle.conquered > 0 ? t.ch_record.replace('{n}', String(castle.bestChallenges ?? 0)) : t.castle_tagline}
                  </span>}
                {!castle.run && castle.lastSummary && (
                  <span role="button" aria-label="last summary" className="t-micro underline cursor-pointer" style={{ color: 'var(--ink-crimson)' }}
                    onClick={e => { e.stopPropagation(); playSfx('open', 0.6); useUiStore.getState().openModal('summary'); }}>
                    {t.sum_last}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Niebla sobre lo desconocido: tapa la parte de arriba del camino */}
          <motion.div className="absolute inset-x-0 top-0 pointer-events-none" initial={false}
            animate={{ height: Math.max(0, topKnown) }} transition={{ duration: phase === 'rise' ? 1.6 : 0.9, ease: 'easeOut' }}
            style={{ background: 'linear-gradient(to bottom, rgba(11,13,12,1) 0%, rgba(30,42,40,0.92) 45%, rgba(94,122,118,0.28) 82%, transparent 100%)' }}>
            {[0.3, 0.6, 0.85].map((f, i) => (
              <motion.div key={i} className="absolute" style={{ top: `${f * 100}%`, left: '-30%', width: '160%', height: 60, marginTop: -30,
                background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(185,207,200,0.16) 0%, transparent 70%)' }}
                animate={{ x: [i % 2 ? -24 : 24, i % 2 ? 24 : -24] }} transition={{ duration: 7 + i * 2, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }} />
            ))}
          </motion.div>
        </div>
      </div>

      {/* Avisos grandes (fijos, sobre el mapa) */}
      <AnimatePresence>
        {phase === 'secret' && <Announce key="secret" title={t.map_secret_title} sub={t.map_secret_sub} tone="gold" />}
        {phase === 'castle' && <Announce key="castle" title={t.map_castle_title} sub={t.map_castle_sub} tone="crimson" />}
      </AnimatePresence>
    </div>
  );
};
