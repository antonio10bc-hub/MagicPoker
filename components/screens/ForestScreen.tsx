import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { useUiStore } from '@/store/useUiStore';
import { Translations, useTranslations } from '@/lib/i18n';
import { Encounter, getForest, getServerForest, rollEncounter, subscribeForest } from '@/lib/forest';
import { haptic, playSfx, playSound } from '@/lib/sounds';
import { track as trackEvent } from '@/lib/analytics';
import { isCollectionUnlocked, isEditorUnlocked } from '@/lib/bosses';
import { INK } from '@/theme/tokens';
import { useStage } from '@/components/pixel/Stage';
import { IconButton, PxButton } from '@/components/pixel/ui';
import { PixelSprite } from '@/components/pixel/PixelSprite';
import { ICONS, MASK } from '@/components/pixel/sprites';
import { ForestFigure, TIER_INK, TIER_RGB } from '@/components/game/ForestFigure';
import { AmbientDust } from '@/components/fx/Ambient';

// --- EL BOSQUE ---
// En primera persona, de noche: troncos negros a los lados (los cercanos, enormes; los
// lejanos, grises de niebla), una banda de niebla en el fondo y, en ella, unos ojos que
// te miran y parpadean. Todo con el mismo tramado estocástico que el resto del juego.
//
// Buscar duelo (con el input bloqueado, por fases):
//  1. stir   · los ojos parpadean nerviosos y se avivan.
//  2. reveal · se encienden en el color de su dificultad y alguien se dibuja alrededor
//              de ellos, entre la niebla; arriba, su nombre y su dificultad.
//  3. lunge  · se abalanza hacia ti: crece de golpe, el bosque se acerca, tiembla todo y
//              un fogonazo de su color da paso al duelo.

type Phase = 'idle' | 'stir' | 'reveal' | 'lunge';
const T = { reveal: 1100, lunge: 3300, start: 4100 };
/** Los únicos se quedan más a la vista antes de abalanzarse */
const UNIQUE_EXTRA_MS = 1400;

const RAMP: [number, number, number][] = ['#0B0D0C', '#1E2A28', '#5E7A76', '#B9CFC8', '#EDEBE0']
  .map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const hash = (x: number, y: number, seed: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
};

interface Trunk { x: number; w: number; d: number; lean: number }

/** Troncos del bosque, deterministas: lejanos finos y grises, medios, y unos pocos
 *  cercanos enormes en los bordes que enmarcan; el centro queda libre para los ojos */
const trunksFor = (W: number): Trunk[] => {
  const out: Trunk[] = [];
  const add = (n: number, dMin: number, dMax: number, seed: number, minGap: number) => {
    for (let i = 0; i < n; i++) {
      const d = dMin + (dMax - dMin) * hash(i, seed, 1);
      // Repartidos a los dos lados, cada vez más lejos del centro cuanto más cerca están
      const side = i % 2 ? 1 : -1;
      const x = W / 2 + side * (W * minGap + hash(i, seed, 2) * W * (0.5 - minGap));
      out.push({ x, w: Math.round(2 + d * d * 34), d, lean: (hash(i, seed, 3) - 0.5) * 0.06 });
    }
  };
  add(10, 0.05, 0.3, 11, 0.07);
  add(6, 0.4, 0.65, 12, 0.18);
  add(4, 0.85, 1, 13, 0.36);
  return out.sort((a, b) => a.d - b.d);
};

/** Pinta una capa del bosque (troncos con profundidad entre dMin y dMax) en un lienzo */
const paintLayer = (ctx: CanvasRenderingContext2D, W: number, H: number, horizon: number, trunks: Trunk[], withSky: boolean) => {
  const img = ctx.createImageData(W, H);
  const L = new Float32Array(W * H).fill(-1);
  if (withSky) {
    for (let y = 0; y < H; y++) {
      // Niebla en el horizonte: banda clara que se apaga arriba y abajo
      const band = Math.exp(-(((y - horizon) / (H * 0.13)) ** 2));
      const ground = y > horizon ? 0.08 + 0.05 * Math.exp(-(((y - H) / (H * 0.12)) ** 2)) : 0;
      for (let x = 0; x < W; x++) {
        const center = Math.exp(-(((x - W / 2) / (W * 0.45)) ** 2));
        L[y * W + x] = 0.05 + band * (0.34 + 0.22 * center) + ground + hash(x, y, 4) * 0.03;
      }
    }
  }
  trunks.forEach((t, i) => {
    // Lejanos: teñidos de niebla; cercanos: negro
    const lum = Math.max(0, 0.26 - t.d * 0.3);
    const base = horizon + t.d * (H - horizon) * 0.95;
    for (let y = 0; y < Math.min(H, base); y++) {
      const cx = t.x + (base - y) * t.lean;
      const half = t.w / 2 * (1 + (base - y) / H * 0.1);
      for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
        if (x < 0 || x >= W) continue;
        // Un filo de luz de niebla del lado del centro en los cercanos
        const rim = t.d > 0.5 && Math.abs(x - (cx + Math.sign(W / 2 - cx) * half)) < 1 && hash(x, y, i) > 0.5 ? 0.18 : 0;
        L[y * W + x] = lum + rim;
      }
      // Ramas: alguna rama fina hacia los lados
      if (t.d > 0.3 && y < base * 0.7 && hash(i, Math.floor(y / 9), 3) > 0.93) {
        const dir = hash(i, y, 6) > 0.5 ? 1 : -1;
        for (let k = 0; k < t.w * 1.6; k++) {
          const bx = Math.round(cx + dir * (half + k)), by = Math.round(y - k * 0.6);
          if (bx >= 0 && bx < W && by >= 0) L[by * W + bx] = lum;
        }
      }
    }
  });
  for (let i = 0; i < W * H; i++) {
    if (L[i] < 0) continue;
    const x = i % W, y = Math.floor(i / W);
    const v = Math.max(0, Math.min(4, Math.floor(L[i] * 4 + (hash(x, y, 1) - 0.5) * 0.9)));
    const c = RAMP[v];
    img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
};

const ForestLayer = ({ W, H, horizon, trunks, sky, sway, zoom }: { W: number; H: number; horizon: number; trunks: Trunk[]; sky?: boolean; sway: number; zoom: number }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) paintLayer(ctx, W, H, horizon, trunks, !!sky);
  }, [W, H, horizon, trunks, sky]);
  return (
    <motion.canvas ref={ref} width={W} height={H} className="absolute left-0 top-0 pointer-events-none"
      style={{ width: W, height: H, imageRendering: 'pixelated', transformOrigin: `50% ${(horizon / H) * 100}%` }}
      animate={{ x: sway ? [-sway, sway, -sway] : 0, scale: zoom }}
      transition={{ x: { duration: 7 + sway * 2, repeat: Infinity, ease: 'easeInOut' }, scale: { duration: 0.7, ease: 'easeIn' } }} />
  );
};

/** Los ojos del fondo: parpadean de vez en cuando y miran a un lado y a otro */
const Eyes = ({ color, rgb, phase }: { color: string; rgb: string; phase: Phase }) => {
  const eye = { width: 3, height: 2, background: color, boxShadow: `0 0 3px rgba(${rgb},0.95), 0 0 8px 1px rgba(${rgb},0.5)` };
  return (
    <motion.div className="absolute flex gap-[4px]" style={{ left: -5, top: -1 }}
      animate={phase === 'idle' ? { x: [0, 0, 2, 2, -2, -2, 0], scaleY: [1, 1, 1, 0.1, 1, 1, 1] }
        : phase === 'stir' ? { scaleY: [1, 0.1, 1, 0.1, 1, 1.4], scale: [1, 1, 1, 1, 1, 1.3] } : { scale: 1.3 }}
      transition={phase === 'idle' ? { duration: 6, repeat: Infinity, times: [0, 0.3, 0.38, 0.5, 0.55, 0.85, 1] } : { duration: 1 }}>
      <span style={eye} /><span style={eye} />
    </motion.div>
  );
};

export const ForestScreen = () => {
  const t = useTranslations();
  const { width: W, height: H, mode } = useStage();
  const forest = useSyncExternalStore(subscribeForest, getForest, getServerForest);
  const exitToMenu = useGameStore(s => s.exitToMenu);
  const [phase, setPhase] = useState<Phase>('idle');
  const [enc, setEnc] = useState<Encounter | null>(null);
  const horizon = Math.round(H * (mode === 'portrait' ? 0.46 : 0.5));
  const trunks = useMemo(() => trunksFor(W), [W]);
  const layers = useMemo(() => [trunks.filter(tr => tr.d < 0.35), trunks.filter(tr => tr.d >= 0.35 && tr.d < 0.8), trunks.filter(tr => tr.d >= 0.8)], [trunks]);
  const busy = phase !== 'idle';

  const seek = () => {
    if (busy) return;
    // (depuración: alguien elegido a mano)
    const forced = useUiStore.getState().forestForce;
    const e = forced ?? rollEncounter();
    if (forced) useUiStore.getState().setForestForce(null);
    // Analíticas: quién sale del bosque (y en qué dificultad)
    trackEvent('forest_encounter', { rival: e.id, tier: e.tier, streak: forest.streak, duels: forest.duels });
    setEnc(e);
    setPhase('stir');
    playSound('click');
    playSfx('heartbeat', 0.8);
  };

  // Toda la secuencia cuelga del encuentro (si colgara de la fase, cada cambio la cortaría)
  useEffect(() => {
    if (!enc) return;
    const extra = enc.tier === 'unique' ? UNIQUE_EXTRA_MS : 0;
    const timers = [
      setTimeout(() => { setPhase('reveal'); playSfx('reveal', 0.9, enc.tier === 'nightmare' || enc.tier === 'renegade' ? 0.5 : enc.tier === 'hard' ? 0.7 : 0.9); haptic('stamp'); }, T.reveal),
      // Los únicos se hacen esperar más (y suenan a realeza)
      ...(enc.tier === 'unique' ? [setTimeout(() => { playSfx('sparkle', 1, 0.6); playSfx('zap', 0.7, 0.5); haptic('win'); }, T.reveal + 500)] : []),
      setTimeout(() => { setPhase('lunge'); playSfx('whoosh', 1, 0.6); playSfx('crush', 0.8, 0.6); haptic('lifeLost'); }, T.lunge + extra),
      setTimeout(() => useGameStore.getState().startForest(enc), T.start + extra),
    ];
    return () => timers.forEach(clearTimeout);
  }, [enc]);

  const color = enc && phase !== 'stir' ? TIER_INK[enc.tier] : INK.amber;
  const rgb = enc && phase !== 'stir' ? TIER_RGB[enc.tier] : '255,194,51';
  const zoom = phase === 'lunge' ? 1.25 : 1;
  const figureH = 44;

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: 'var(--ink-black)' }}>
      {/* El bosque en tres capas que se mecen distinto (y se acercan al abalanzarse) */}
      <motion.div className="absolute inset-0" animate={phase === 'lunge' ? { x: [0, -4, 4, -3, 3, 0], y: [0, 2, -2, 1, 0] } : { x: 0, y: 0 }} transition={{ duration: 0.6 }}>
        <ForestLayer W={W} H={H} horizon={horizon} trunks={layers[0]} sky sway={0} zoom={phase === 'lunge' ? 1.08 : 1} />
        {/* Los ojos y quien sale, en la niebla del fondo */}
        <div className="absolute" style={{ left: W / 2, top: horizon - 4 }}>
          <AnimatePresence>
            {enc && (phase === 'reveal' || phase === 'lunge') && (
              <motion.div key="who" className="absolute" style={{ left: 0, top: 0, x: '-50%', y: -figureH * 0.28, transformOrigin: '50% 30%' }}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={phase === 'lunge' ? { opacity: 1, scale: [1, 1.2, 7], y: [-figureH * 0.28, -figureH * 0.28, figureH * 0.6] } : { opacity: [0, 0.4, 1], scale: [0.5, 0.8, 1] }}
                transition={phase === 'lunge' ? { duration: 0.8, times: [0, 0.3, 1], ease: 'easeIn' } : { duration: 2, times: [0, 0.4, 1] }}>
                <ForestFigure id={enc.id} tier={enc.tier} height={figureH} mode="shadow" />
              </motion.div>
            )}
          </AnimatePresence>
          {phase !== 'reveal' && phase !== 'lunge' && <Eyes color={color} rgb={rgb} phase={phase} />}
          {/* Resplandor de su color detrás */}
          <motion.span className="absolute pointer-events-none rounded-full" style={{ left: -40, top: -40, width: 80, height: 80, background: `radial-gradient(circle, rgba(${rgb},0.35) 0%, transparent 65%)` }}
            animate={{ opacity: busy ? [0.4, 1, 0.8] : [0.15, 0.3, 0.15], scale: phase === 'lunge' ? 4 : 1 }}
            transition={busy ? { duration: 1.2 } : { duration: 4, repeat: Infinity }} />
        </div>
        <ForestLayer W={W} H={H} horizon={horizon} trunks={layers[1]} sway={1} zoom={phase === 'lunge' ? 1.18 : 1} />
        <ForestLayer W={W} H={H} horizon={horizon} trunks={layers[2]} sway={2} zoom={zoom} />
      </motion.div>
      <AmbientDust />
      {/* Viñeta */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 75% 65% at 50% 48%, transparent 40%, rgba(11,13,12,0.85) 100%)' }} />

      {/* Cabecera: volver, título y bestiario */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-[6px] pt-[6px]">
        <IconButton icon={ICONS.home} aria-label={t.aria_forest_back} onClick={() => { if (busy) return; playSound('click'); exitToMenu(); }} />
        <span className="font-display glow-amber" style={{ color: 'var(--ink-amber)', fontSize: 14, letterSpacing: 3 }}>{t.forest_title}</span>
        {/* Lo tuyo (sellos y mazo), como en el menú, y el bestiario */}
        <span className="flex gap-[3px]">
          {isCollectionUnlocked() && (
            <PxButton aria-label={t.aria_collection} className="w-[18px] h-[18px]" onClick={() => { if (busy) return; playSound('click'); useUiStore.getState().openModal('collection'); }}>
              <PixelSprite sprite={ICONS.book} tint={INK.volt} />
            </PxButton>
          )}
          {isEditorUnlocked() && (
            <PxButton aria-label={t.aria_deck} className="w-[18px] h-[18px]" onClick={() => { if (busy) return; playSound('click'); useUiStore.getState().openModal('deck'); }}>
              <PixelSprite sprite={ICONS.deck} tint={INK.orange} />
            </PxButton>
          )}
          <span className="w-[1px] mx-[2px] self-stretch" style={{ background: 'rgba(185,207,200,0.15)' }} />
          <PxButton aria-label={t.aria_bestiary} className="w-[18px] h-[18px]" onClick={() => { if (busy) return; playSound('click'); useUiStore.getState().openModal('bestiary'); }}>
            <PixelSprite sprite={MASK} tint={INK.amber} />
          </PxButton>
        </span>
      </div>

      {/* Quién ha salido: nombre y dificultad */}
      <AnimatePresence>
        {enc && phase === 'reveal' && (
          <motion.div key="label" className="absolute inset-x-0 z-20 flex flex-col items-center gap-[2px]" style={{ top: horizon - 92 }}
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.5, duration: 0.6 }}>
            <span className="font-display px-[6px] rounded-[2px]" style={{ fontSize: 11, lineHeight: '13px', paddingTop: 1, color: 'var(--ink-black)', background: TIER_INK[enc.tier], boxShadow: `0 0 10px rgba(${TIER_RGB[enc.tier]},0.7)` }}>
              {t[`tier_${enc.tier}` as keyof Translations]}
            </span>
            <span className="text-outline" style={{ fontSize: 12, color: TIER_INK[enc.tier] }}>{t[`forest_${enc.id}` as keyof Translations]}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fogonazo de su color al abalanzarse */}
      <AnimatePresence>
        {enc && phase === 'lunge' && (
          <motion.div key="flash" className="absolute inset-0 z-30 pointer-events-none" style={{ background: `rgba(${TIER_RGB[enc.tier]},1)` }}
            initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 1] }} transition={{ duration: 0.8, times: [0, 0.6, 1] }} />
        )}
      </AnimatePresence>

      {/* Abajo: la frase y buscar duelo */}
      <motion.div className="absolute inset-x-0 z-20 flex flex-col items-center gap-[5px]" style={{ bottom: mode === 'portrait' ? 24 : 18 }}
        animate={{ opacity: busy ? 0 : 1 }} transition={{ duration: 0.4 }}>
        <span className="t-micro text-center px-[16px]" style={{ color: 'var(--ink-mint)' }}>{t.forest_idle}</span>
        <PxButton tone="amber" onClick={seek} disabled={busy} className="h-[30px] flex-col gap-[1px] anim-breathe" style={{ width: Math.min(170, W - 24) }}>
          <span className="text-title" style={{ lineHeight: '14px' }}>{t.forest_search}</span>
          <span className="t-micro normal-case" style={{ color: 'rgba(11,13,12,0.75)' }}>
            {t.forest_streak.replace('{n}', String(forest.streak))} · {t.forest_best.replace('{n}', String(forest.bestStreak))}
          </span>
        </PxButton>
      </motion.div>

      {/* Mientras sale alguien, nada responde */}
      {busy && <div aria-label="forest encounter" className="absolute inset-0 z-[500]" />}
    </div>
  );
};
