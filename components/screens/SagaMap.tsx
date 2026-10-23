import { CSSProperties, ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
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
import { Sprite } from '@/components/pixel/PixelSprite';
import { SCENERY } from '@/components/pixel/scenery';
import { MapTerrain, Pt } from './MapTerrain';
import { StationProp, STATIONS } from './mapStations';
import { BossFigure } from '@/components/game/BossFigure';
import { CastleMap } from '@/components/game/CastleMap';

// --- MAPA DE JEFES (menú) ---
// Un camino de tierra que sube por el campo de abajo arriba, entre bosques. Cada jefe
// es una parada del camino, en un sitio que cuenta quién es (el fortín del Muro, la
// guarida de la Ladrona, la taberna del Bardo… ver mapStations.ts). Sobre el camino,
// un sendero de puntos: crema lo recorrido, pizarra lo que falta. Las paradas que aún
// no has alcanzado tienen las luces apagadas. Arriba del todo, el Castillo. Lo que aún no conoces no se ve: el
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

const STEP = 200;
const BOTTOM = 120;
const CASTLE_GAP = 150;
/** Sitio sobre el Castillo para su pastilla y la cabecera del menú */
const TOP = 80;
const CASTLE_H = 104;

type Phase = 'idle' | 'focus' | 'beaten' | 'path' | 'next' | 'secret' | 'summon' | 'land' | 'castle' | 'rise' | 'emerge' | 'lit';
/** Momentos de cada fase (ms desde que empieza el paso) */
const T = {
  beaten: 1000, path: 3700, arrive: 5600, nextDone: 7400,
  // Soberano: aviso → haz de luz y descenso lento → aterriza
  summon: 8400, land: 11600, secretDone: 14400,
  // Castillo: aviso → la cámara sube y la niebla se abre → emerge de la tierra → se enciende
  rise: 8400, emerge: 10000, lit: 13400, castleDone: 15600,
};

const geometry = (w: number) => {
  const n = BOSSES.length;
  const castle = { x: Math.round(w / 2), y: TOP + CASTLE_H };
  const contentH = castle.y + CASTLE_GAP + (n - 1) * STEP + BOTTOM;
  // Las paradas, a un lado y a otro del centro; el Soberano, en medio, ante su puerta
  const amp = Math.round(w * 0.13);
  const nodes = BOSSES.map((b, i) => ({ x: b.secret ? Math.round(w / 2) : Math.round(w / 2 + sideOf(i) * amp), y: contentH - BOTTOM - i * STEP }));
  // El camino entero: entra por abajo, pasa por cada parada y llega al Castillo
  const stops = [{ x: nodes[0].x - 10, y: contentH + 10 }, ...nodes, castle];
  const road: Pt[] = stops.slice(1).flatMap((b, n) => curve(stops[n], b, 1));
  const terrain = BOSSES.map((b, i) => {
    const st = STATIONS[b.id];
    const side = sideOf(i);
    return {
      clearing: nodes[i],
      keep: { x: nodes[i].x, y: nodes[i].y - 12, rx: 104, ry: 64 },
      biome: st?.biome && { kind: st.biome.kind, x: nodes[i].x + side * st.biome.dx, y: nodes[i].y + st.biome.dy, rx: st.biome.rx, ry: st.biome.ry },
    };
  });
  return {
    contentH, nodes, castle, road,
    clearings: [...terrain.map(t => t.clearing), castle],
    keepOut: [...terrain.map(t => t.keep), { x: castle.x, y: castle.y - 50, rx: 70, ry: 70 }],
    biomes: terrain.flatMap(t => (t.biome ? [t.biome] : [])),
  };
};

/** Lado de cada parada: -1 izquierda, 1 derecha (el decorado va hacia fuera) */
const sideOf = (i: number) => (BOSSES[i]?.secret ? 1 : i % 2 === 0 ? -1 : 1);

/** Curva suave entre dos sitios (salidas en vertical), un punto cada `every` px */
const curve = (a: Pt, b: Pt, every: number): Pt[] => {
  const c1 = { x: a.x, y: a.y - (a.y - b.y) * 0.55 };
  const c2 = { x: b.x, y: b.y + (a.y - b.y) * 0.55 };
  const count = Math.max(4, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) * 1.2 / every));
  return Array.from({ length: count }, (_, i) => {
    const t = i / count;
    const u = 1 - t;
    return {
      x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
      y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
    };
  });
};

/** Puntos del sendero sobre el camino (uno cada 6 px), sin pisar las paradas */
const trail = (a: Pt, b: Pt, endPad = 16) =>
  curve(a, b, 6).map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }))
    .filter(p => Math.hypot(p.x - a.x, p.y - a.y) > 18 && Math.hypot(p.x - b.x, p.y - b.y) > endPad);

const Trail = ({ a, b, lit, drawing, endPad }: { a: { x: number; y: number }; b: { x: number; y: number }; lit: boolean; drawing?: boolean; endPad?: number }) => {
  const pts = useMemo(() => trail(a, b, endPad), [a, b, endPad]);
  return (
    <>
      {pts.map((p, i) => (
        <motion.span key={i} className="absolute pointer-events-none" style={{ left: p.x - 1, top: p.y - 1, width: 2, height: 2,
          background: lit ? 'var(--ink-cream)' : 'var(--ink-slate)', boxShadow: lit ? '0 0 3px rgba(237,235,224,0.6)' : undefined }}
          initial={drawing ? { opacity: 0, scale: 2.5 } : false} animate={{ opacity: lit ? 0.9 : 0.6, scale: 1 }}
          transition={drawing ? { delay: (i / pts.length) * 1.6, duration: 0.25 } : undefined} />
      ))}
    </>
  );
};

/** Sombra a los pies (y, en el Castillo, brasa carmesí) */
const Ground = ({ castle }: { castle?: boolean }) => (
  <div className="absolute pointer-events-none" style={{ left: -26, top: -6, width: 52, height: 12, borderRadius: '50%',
    background: castle ? 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255,31,75,0.35) 0%, transparent 70%)'
      : 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(11,13,12,0.85) 30%, transparent 72%)' }} />
);

// --- Decorados de las paradas ---
const LIGHTS = /[xyk]/g;
const split = new Map<Sprite, { unlit: Sprite; lights: Sprite; gold: boolean }>();
/** El decorado sin luces (apagado) y sus luces aparte (para que brillen) */
const lightsOf = (sprite: Sprite) => {
  let v = split.get(sprite);
  if (!v) {
    v = {
      unlit: { rows: sprite.rows.map(r => r.replace(LIGHTS, 'd')) },
      lights: { rows: sprite.rows.map(r => r.replace(/[^xyk]/g, '.')) },
      gold: sprite.rows.some(r => r.includes('k')),
    };
    split.set(sprite, v);
  }
  return v;
};

/** Los decorados, algo más grandes que su dibujo para que estén a la escala de los jefes */
const PROP_SCALE = 1.5;

const MapProp = ({ prop, at, side, lit, z, mapW }: { prop: StationProp; at: Pt; side: number; lit: boolean; z: number; mapW: number }) => {
  const sprite = SCENERY[prop.id];
  const size = spriteSize(sprite);
  const w = size.width * PROP_SCALE;
  const h = size.height * PROP_SCALE;
  const { unlit, lights, gold } = lightsOf(sprite);
  const mirror = (side < 0) !== !!prop.flip;
  const anim = prop.anim === 'smoke' ? { y: [0, -6], opacity: [0.9, 0] }
    : prop.anim === 'float' ? { y: [0, -3, 0] } : undefined;
  return (
    <motion.div className="absolute pointer-events-none"
      style={{ left: Math.round(Math.max(2, Math.min(mapW - w - 2, at.x + side * prop.dx - w / 2))), top: at.y + prop.dy - h, width: w, height: h, zIndex: z, scaleX: mirror ? -1 : 1 }}
      animate={lit || prop.anim === 'float' ? anim : undefined}
      transition={anim ? { duration: prop.anim === 'smoke' ? 2.6 : 2.2, repeat: Infinity, ease: 'easeInOut' } : undefined}>
      {/* Lo que aún no conoces: sus sitios a oscuras; el humo y las notas, solo si hay alguien */}
      {(lit || (prop.anim !== 'smoke' && prop.anim !== 'float')) && (
        <PixelSprite sprite={lit ? sprite : unlit} style={{ position: 'absolute', inset: 0, width: w, height: h, opacity: lit ? 1 : 0.8 }} />
      )}
      {lit && (
        <PixelSprite sprite={lights} className={clsx(gold ? 'bloom-gold-shape' : 'bloom-shape', prop.anim === 'flicker' && 'anim-flicker', prop.anim === 'twinkle' && 'anim-pulse-soft')}
          style={{ position: 'absolute', inset: 0, width: w, height: h }} />
      )}
    </motion.div>
  );
};

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
const CastleArt = ({ height, lit = true }: { height: number; lit?: boolean }) => {
  const { width: w, height: h } = spriteSize(CASTLE_ART.body);
  const size = { width: (w * height) / h, height };
  const layer: CSSProperties = { position: 'absolute', inset: 0, ...size };
  return (
    <div className="relative" style={size}>
      {/* Al emerger, apagado: solo la silueta; al encenderse, resplandor, aura y ventanas */}
      <motion.div className="absolute inset-0" initial={false} animate={{ opacity: lit ? 1 : 0 }} transition={{ duration: 1.6 }}>
        <div className="absolute pointer-events-none anim-pulse-soft" style={{ left: '-60%', top: '-20%', width: '220%', height: '140%',
          background: 'radial-gradient(ellipse 50% 50% at 50% 55%, rgba(255,31,75,0.42) 0%, rgba(255,31,75,0.14) 42%, transparent 70%)' }} />
        <PixelSprite sprite={spriteAura(CASTLE_ART.body, 2, 'castle')} tint={INK.crimson} className="anim-flicker bloom-crimson-shape" style={layer} />
      </motion.div>
      <PixelSprite sprite={CASTLE_ART.body} tint={INK.black} style={layer} />
      <motion.div className="absolute inset-0" initial={false} animate={{ opacity: lit ? [0, 1, 0.3, 1] : 0 }} transition={{ duration: 1.2, times: [0, 0.3, 0.5, 1] }}>
        <PixelSprite sprite={CASTLE_ART.windows} tint={INK.crimson} className="bloom-crimson-shape anim-pulse-soft" style={layer} />
      </motion.div>
    </div>
  );
};

/** Bandera blanca: el jefe vencido se ha ido y su pueblo se rinde */
const WhiteFlag = ({ fresh }: { fresh: boolean }) => {
  const { width: w, height: h } = spriteSize(SCENERY.white_flag);
  return (
    <motion.div className="absolute pointer-events-none" style={{ left: -3, bottom: 0, width: w * PROP_SCALE, height: h * PROP_SCALE, transformOrigin: '10% 100%' }}
      initial={fresh ? { scaleY: 0, opacity: 0 } : false} animate={{ scaleY: 1, opacity: 1 }}
      transition={{ delay: fresh ? 1.6 : 0, duration: 0.8, ease: 'easeOut' }}>
      <PixelSprite sprite={SCENERY.white_flag} className="bloom-cream" style={{ width: w * PROP_SCALE, height: h * PROP_SCALE }} />
    </motion.div>
  );
};

/** Chispas que suben (deterministas) */
const Embers = ({ n, w, h, colors, duration = 1.8 }: { n: number; w: number; h: number; colors: string[]; duration?: number }) => (
  <>
    {Array.from({ length: n }, (_, i) => {
      const x = ((i * 37) % 23) / 22 - 0.5;
      return (
        <motion.span key={i} className="absolute pointer-events-none" style={{ left: x * w - 1, top: -2, width: i % 3 ? 2 : 3, height: i % 3 ? 2 : 3,
          background: colors[i % colors.length], boxShadow: `0 0 4px ${colors[i % colors.length]}` }}
          initial={{ y: 0, opacity: 0 }} animate={{ y: [0, -h * (0.5 + ((i * 53) % 10) / 20)], opacity: [0, 1, 0] }}
          transition={{ duration, delay: (i % 7) * 0.22, repeat: Infinity, ease: 'easeOut' }} />
      );
    })}
  </>
);

/** Polvo que levanta algo al tocar tierra (motas crema que salen hacia los lados) */
const Dust = ({ w, repeat = 0 }: { w: number; repeat?: number }) => (
  <>
    {Array.from({ length: 18 }, (_, i) => {
      const dir = i % 2 ? 1 : -1;
      const far = 0.3 + ((i * 29) % 10) / 14;
      return (
        <motion.span key={i} className="absolute pointer-events-none" style={{ left: -1, top: -3, width: 3, height: 2, background: i % 3 ? 'var(--ink-mint)' : 'var(--ink-cream)' }}
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{ x: dir * far * w * 0.5, y: [0, -6 - (i % 4) * 3, 2], opacity: [0, 0.9, 0] }}
          transition={{ duration: 1.1, delay: (i % 5) * 0.05, repeat, repeatDelay: 0.15, ease: 'easeOut' }} />
      );
    })}
  </>
);

/** Llegada del Soberano: un haz de oro baja del cielo, él desciende dentro despacio y, al tocar tierra, onda y polvo */
const SummonFx = ({ landed, h }: { landed: boolean; h: number }) => (
  <>
    <motion.div className="absolute pointer-events-none" style={{ left: -18, width: 36, top: -320, height: 322, transformOrigin: '50% 0%',
      background: 'linear-gradient(to bottom, transparent 0%, rgba(232,182,74,0.35) 35%, rgba(255,233,168,0.75) 85%, rgba(237,235,224,0.9) 100%)',
      maskImage: 'repeating-linear-gradient(to bottom, #000 0 2px, rgba(0,0,0,0.55) 2px 3px)', WebkitMaskImage: 'repeating-linear-gradient(to bottom, #000 0 2px, rgba(0,0,0,0.55) 2px 3px)' }}
      initial={{ scaleY: 0, opacity: 0 }} animate={landed ? { scaleY: 1, opacity: 0, scaleX: 2.2 } : { scaleY: 1, opacity: 1, scaleX: [1, 0.85, 1] }}
      transition={landed ? { duration: 0.9 } : { scaleY: { duration: 0.9, ease: 'easeOut' }, scaleX: { duration: 1.2, repeat: Infinity }, opacity: { duration: 0.4 } }} />
    {/* Resplandor de oro en el suelo, creciendo */}
    <motion.div className="absolute pointer-events-none" style={{ left: -60, width: 120, top: -h - 30, height: h + 50,
      background: 'radial-gradient(ellipse 50% 50% at 50% 70%, rgba(255,233,168,0.55) 0%, rgba(232,182,74,0.22) 40%, transparent 70%)' }}
      initial={{ opacity: 0 }} animate={{ opacity: landed ? [1, 0.35] : [0, 0.8] }} transition={{ duration: landed ? 1.4 : 2.6 }} />
    {!landed && <Embers n={16} w={44} h={90} colors={['#E8B64A', '#FFE9A8', '#FF1F4B']} />}
    {landed && (
      <>
        {[0, 0.18].map((d, i) => (
          <motion.span key={i} className="absolute rounded-full pointer-events-none" style={{ left: -40, top: -h / 2 - 40, width: 80, height: 80,
            boxShadow: i ? '0 0 0 2px rgba(255,31,75,0.9), 0 0 16px 4px rgba(255,31,75,0.45)' : '0 0 0 3px rgba(232,182,74,0.95), 0 0 18px 5px rgba(232,182,74,0.5)' }}
            initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: [0.2, 2.6], opacity: [0, 1, 0] }} transition={{ delay: d, duration: 1.3, ease: 'easeOut' }} />
        ))}
        <Dust w={110} />
        <Embers n={20} w={70} h={120} colors={['#E8B64A', '#FFE9A8']} duration={2.2} />
      </>
    )}
  </>
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
  const camera = useRef(0);
  const { contentH, nodes, castle: castlePt, road, clearings, keepOut, biomes } = useMemo(() => geometry(rect.w), [rect.w]);

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
    cancelAnimationFrame(camera.current);
    if (!smooth) { el.scrollTop = top; return; }
    // Travelling lento y suave (el scroll suave del navegador va demasiado rápido)
    const from = el.scrollTop;
    const start = performance.now();
    const DURATION = 1500;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      el.scrollTop = from + (top - from) * e;
      if (t < 1) camera.current = requestAnimationFrame(tick);
    };
    camera.current = requestAnimationFrame(tick);
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
      at(clock + T.beaten, () => { setPhase('beaten'); setShown(k + 1); playSfx('whoosh', 0.6, 0.7); });
      at(clock + T.beaten + 1700, () => { playSfx('flip', 0.6, 0.8); haptic('stamp'); });
      at(clock + T.path, () => { setPhase('path'); playSfx('whoosh', 0.5, 1.2); lookAt((yOf(k) + yOf(next)) / 2); });
      if (s.then === 'next') {
        at(clock + T.arrive, () => { setPhase('next'); lookAt(yOf(next)); playSfx('flip', 0.7, 0.9); playSfx('sparkle', 0.6, 1.2); haptic('stamp'); });
        clock += T.nextDone;
      } else if (s.then === 'secret') {
        at(clock + T.arrive, () => { setPhase('secret'); lookAt(yOf(next)); playSfx('zap', 0.8, 0.5); playSfx('heartbeat', 0.8); haptic('lifeLost'); });
        at(clock + T.summon, () => { setPhase('summon'); playSfx('reveal', 0.8, 0.6); playSfx('sparkle', 0.7, 0.6); });
        at(clock + T.summon + 1400, () => playSfx('heartbeat', 0.9));
        at(clock + T.land, () => { setPhase('land'); playSfx('crush', 1, 0.45); playSfx('wipe', 0.8, 0.7); haptic('win'); });
        at(clock + T.land + 500, () => playSfx('sparkle', 0.9, 0.8));
        clock += T.secretDone;
      } else {
        at(clock + T.arrive, () => { setPhase('castle'); playSfx('crush', 1, 0.5); haptic('lifeLost'); });
        at(clock + T.rise, () => { setPhase('rise'); lookAt(yOf(CASTLE_INDEX)); playSfx('whoosh', 0.6, 0.5); });
        at(clock + T.emerge, () => { setPhase('emerge'); playSfx('crush', 1, 0.35); haptic('lifeLost'); });
        at(clock + T.emerge + 1100, () => { playSfx('crush', 0.8, 0.4); haptic('stamp'); });
        at(clock + T.emerge + 2200, () => { playSfx('crush', 0.7, 0.5); haptic('stamp'); });
        at(clock + T.lit, () => { setPhase('lit'); playSfx('zap', 0.9, 0.5); playSfx('sparkle', 0.9, 0.6); haptic('win'); });
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
      cancelAnimationFrame(camera.current);
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
  const castleVisible = castleOpen && !(target === CASTLE_INDEX && before(['focus', 'beaten', 'path', 'castle', 'rise']));
  const trailLit = (i: number) => i < shown && !(step?.beaten === i && before(['focus', 'beaten']));
  const visible = (i: number) => (!BOSSES[i].secret || shown >= i) && !hidden(i);
  // La niebla tapa todo lo que está por encima de lo último que conoces
  const castleRising = target === CASTLE_INDEX && ['rise', 'emerge', 'lit'].includes(phase);
  const topKnown = castleVisible || castleRising ? castlePt.y - CASTLE_H - 40
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
        <motion.div className="relative" style={{ height: contentH, width: rect.w }}
          animate={phase === 'land' ? { x: [0, -4, 4, -3, 3, -1, 0], y: [0, 2, -2, 1, 0] }
            : phase === 'emerge' ? { x: [0, -2, 2, -2, 2, -1, 1, -2, 2, 0], y: [0, 1, 0, 1, 0] } : { x: 0, y: 0 }}
          transition={phase === 'emerge' ? { duration: 3.2, ease: 'linear' } : { duration: 0.6 }}>
          {/* El campo: camino de tierra, claros, agua y bosque */}
          <MapTerrain width={rect.w} height={contentH} road={road} clearings={clearings} biomes={biomes} keepOut={keepOut} />
          {/* Los sitios de cada jefe (detrás y delante de él) */}
          {BOSSES.map((boss, i) => {
            if (!visible(i)) return null;
            const lit = (i < shown || (i === current && !pendingLocked(i))) && !(i === target && phase === 'summon');
            return [...(STATIONS[boss.id]?.props ?? [])].sort((a, b) => a.dy - b.dy).map((prop, n) => (
              <MapProp key={`${boss.id}-${n}`} prop={prop} at={nodes[i]} side={sideOf(i)} lit={lit} z={1} mapW={rect.w} />
            ));
          })}
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
            const arriving = i === target && (phase === 'next' || phase === 'summon' || phase === 'land');
            const seals = Array.from(new Set(bossSeals(boss)));
            const summoning = arriving && step?.then === 'secret';
            return (
              <div key={boss.id} className="absolute" style={{ left: p.x, top: p.y, width: 0, height: 0, zIndex: isSel ? 5 : 2 }}>
                <Ground />
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
                {/* Vencido: se desvanece de su pueblo y queda una bandera blanca */}
                {beaten && <WhiteFlag fresh={justBeaten} />}
                <AnimatePresence>
                  {!beaten && (
                    <motion.div key="boss" className="absolute" style={{ left: 0, bottom: 2, x: '-50%', transformOrigin: '50% 100%' }}
                      initial={summoning ? { y: -260, scale: 1.7, opacity: 0, filter: 'brightness(3)' } : false}
                      animate={summoning && phase === 'summon'
                        ? { y: [-260, -50, 0], scale: [1.7, 1.15, 1], opacity: [0, 1, 1], filter: ['brightness(3)', 'brightness(2.2)', 'brightness(1.5)'] }
                        : summoning ? { scaleY: [0.82, 1.1, 1], scaleX: [1.15, 0.95, 1], filter: ['brightness(3.5)', 'brightness(1)'] }
                          : arriving ? { scale: [1, 1.25, 1], filter: ['brightness(1)', 'brightness(2.6)', 'brightness(1)'] } : {}}
                      exit={{ opacity: 0, y: -10, filter: 'brightness(2.2) blur(1px)', transition: { duration: 1.6, ease: 'easeIn' } }}
                      transition={summoning && phase === 'summon' ? { duration: 3, times: [0, 0.78, 1], ease: 'easeInOut' } : { duration: summoning ? 0.7 : 0.6 }}>
                      <div className={isCurrent ? 'anim-breathe' : undefined}>
                        <BossFigure id={boss.id} height={boss.secret ? figureH + 8 : figureH} dim={locked} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {summoning && <SummonFx landed={phase === 'land'} h={figureH + 8} />}
                {/* Onda al llegar */}
                {arriving && !summoning && (
                  <motion.span className="absolute rounded-full pointer-events-none" style={{ left: -30, top: -50, width: 60, height: 60,
                    boxShadow: boss.secret ? '0 0 0 2px rgba(232,182,74,0.95), 0 0 14px 4px rgba(255,31,75,0.5)' : '0 0 0 2px rgba(255,74,28,0.9), 0 0 12px 3px rgba(255,74,28,0.4)' }}
                    initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: [0.2, 1.8], opacity: [0, 1, 0] }}
                    transition={{ delay: boss.secret ? 0.85 : 0.15, duration: 0.9, ease: 'easeOut' }} />
                )}
                {/* Arriba: estado (o sus estrellas si ya lo venciste) */}
                <div className="absolute flex justify-center" style={{ left: -50, width: 100, top: -(figureH + (boss.secret ? 22 : 14)) }}>
                  <AnimatePresence mode="wait">
                    {justBeaten && phase === 'beaten' ? null
                      : beaten && !boss.secret ? <Stars key="stars" lit={wins} pop={justBeaten} />
                        : isSel && !isCurrent ? <Pill key="n" tone="muted">{t.boss_n.replace('{n}', String(i + 1)).replace('{total}', total)}</Pill> : null}
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
              {/* Elegido: resplandor carmesí detrás (sin anillo) */}
              {selected === CASTLE_INDEX && !revealing && (
                <span className="absolute pointer-events-none anim-pulse-soft" style={{ left: -80, top: -CASTLE_H - 20, width: 160, height: CASTLE_H + 40,
                  background: 'radial-gradient(ellipse 50% 50% at 50% 60%, rgba(255,31,75,0.22) 0%, transparent 70%)' }} />
              )}
              {/* El cielo se rasga en carmesí mientras emerge, y estalla al encenderse */}
              {(phase === 'emerge' || phase === 'lit') && (
                <motion.span className="absolute pointer-events-none" style={{ left: -110, top: -CASTLE_H - 60, width: 220, height: CASTLE_H + 90,
                  background: 'radial-gradient(ellipse 50% 50% at 50% 55%, rgba(255,31,75,0.8) 0%, rgba(255,31,75,0.25) 40%, transparent 70%)' }}
                  initial={{ opacity: 0 }}
                  animate={phase === 'emerge' ? { opacity: [0, 0.5, 0.05, 0.25, 0.6, 0.1, 0.35] } : { opacity: [0.9, 0.3] }}
                  transition={phase === 'emerge' ? { duration: 3.2, times: [0, 0.1, 0.2, 0.45, 0.55, 0.7, 1] } : { duration: 1.8 }} />
              )}
              {/* Sale de la tierra: se recorta a ras de suelo y sube temblando */}
              <div className="absolute overflow-hidden pointer-events-none" style={{ left: -70, width: 140, top: -CASTLE_H - 30, height: CASTLE_H + 32 }}>
                <motion.div className="absolute" style={{ left: 70, bottom: 2, x: '-50%' }}
                  initial={false}
                  animate={phase === 'emerge' ? { y: [CASTLE_H + 4, CASTLE_H * 0.7, CASTLE_H * 0.35, 0] } : { y: 0 }}
                  transition={phase === 'emerge' ? { duration: 3.2, times: [0, 0.3, 0.65, 1], ease: 'easeOut' } : { duration: 0 }}>
                  <CastleArt height={CASTLE_H} lit={phase !== 'emerge'} />
                </motion.div>
              </div>
              {phase === 'emerge' && <Dust w={150} repeat={2} />}
              {phase === 'lit' && <div className="absolute" style={{ left: 0, top: -CASTLE_H * 0.4 }}><Embers n={18} w={90} h={110} colors={['#FF1F4B', '#FF4A1C', '#EDEBE0']} duration={2.4} /></div>}
              <div className="absolute flex justify-center" style={{ left: -60, width: 120, top: -CASTLE_H - 16 }}>
                <motion.span initial={phase === 'emerge' ? { scale: 0, opacity: 0 } : false} animate={phase === 'emerge' ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
                  transition={{ delay: phase === 'lit' ? 1 : 0, type: 'spring', stiffness: 500, damping: 14 }}>
                  <Pill tone="castle">
                    {castle.run ? t.castle_floor.replace('{n}', String(castle.run.stage + 1)).replace('{total}', total)
                      : t.castle_best.replace('{n}', String(castle.best)).replace('{total}', total)}
                  </Pill>
                </motion.span>
              </div>
              <motion.div className="absolute flex flex-col items-center gap-[3px]" style={{ left: -80, width: 160, top: 16 }}
                initial={false} animate={{ opacity: phase === 'emerge' ? 0 : 1 }} transition={{ delay: phase === 'lit' ? 1.2 : 0, duration: 0.8 }}>
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
              </motion.div>
            </div>
          )}

          {/* Niebla sobre lo desconocido: tapa la parte de arriba del camino */}
          <motion.div className="absolute inset-x-0 top-0 pointer-events-none" initial={false}
            animate={{ height: Math.max(0, topKnown) }} transition={{ duration: phase === 'emerge' || phase === 'rise' ? 2.6 : 0.9, ease: 'easeOut' }}
            style={{ background: 'linear-gradient(to bottom, rgba(11,13,12,1) 0%, rgba(30,42,40,0.92) 45%, rgba(94,122,118,0.28) 82%, transparent 100%)' }}>
            {[0.3, 0.6, 0.85].map((f, i) => (
              <motion.div key={i} className="absolute" style={{ top: `${f * 100}%`, left: '-30%', width: '160%', height: 60, marginTop: -30,
                background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(185,207,200,0.16) 0%, transparent 70%)' }}
                animate={{ x: [i % 2 ? -24 : 24, i % 2 ? 24 : -24] }} transition={{ duration: 7 + i * 2, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }} />
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Avisos grandes (fijos, sobre el mapa) */}
      <AnimatePresence>
        {phase === 'secret' && <Announce key="secret" title={t.map_secret_title} sub={t.map_secret_sub} tone="gold" />}
        {phase === 'castle' && <Announce key="castle" title={t.map_castle_title} sub={t.map_castle_sub} tone="crimson" />}
      </AnimatePresence>
    </div>
  );
};
