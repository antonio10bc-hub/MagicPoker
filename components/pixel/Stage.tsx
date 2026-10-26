import { createContext, ReactNode, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { motion, MotionConfig, useAnimationControls } from 'framer-motion';
import { STAGE } from '@/theme/tokens';
import { computeGameLayout, computeMenuLayout, LANDSCAPE_STAGE, StageSize } from '@/theme/layout';
import { useFxStore } from '@/components/fx/fxStore';
import { FilmGrain } from '@/components/fx/FilmGrain';

// --- ESCALADO ENTERO ---
// La escala se calcula en píxeles FÍSICOS (devicePixelRatio) para que cada píxel
// interno ocupe un número entero de píxeles reales.
//  - Horizontal (ordenador): el alto interno ronda los 288 px y el ancho sigue la
//    proporción de la pantalla (de 4:3 a 32:9), así el juego la llena sin franjas
//    negras. Se busca el entero n que deja el alto en [LANDSCAPE_MIN_H, LANDSCAPE_MAX_H];
//    si no hay, ajuste exacto a 288 de alto.
//  - Vertical (móvil): se elige el entero n que deja un ancho interno ≤ 260 px y el
//    alto interno se adapta a la pantalla, así el juego la llena entera.
const LANDSCAPE_MIN_H = 260;
const LANDSCAPE_MAX_H = 330;
// Tope de ancho (hasta 32:9): las distribuciones centran lo importante y el fondo llena
const LANDSCAPE_MAX_W = 1100;
// Ancho interno mínimo en vertical: el tablero de 4 cartas cabe justo. Cuanto más
// estrecho, más grande se ve todo en el móvil.
const PORTRAIT_MIN_W = 180;
const PORTRAIT_MAX_W = 300;
const PORTRAIT_MIN_H = 330;
const PORTRAIT_RATIO = 1.15; // alto / ancho a partir del cual se considera vertical

const landscape = (vw: number, vh: number, dpr: number): StageSize => {
  const devW = vw * dpr;
  const devH = vh * dpr;
  for (let n = Math.floor(devH / LANDSCAPE_MIN_H); n >= 1; n--) {
    const height = Math.floor(devH / n);
    if (height > LANDSCAPE_MAX_H) break;
    const width = Math.min(LANDSCAPE_MAX_W, Math.floor(devW / n));
    if (width >= STAGE.width) return { width, height, scale: n / dpr, mode: 'landscape' };
  }
  // Sin entero que cuadre: ajuste exacto (288 de alto o 384 de ancho, lo que limite)
  const scale = Math.min(vw / STAGE.width, vh / STAGE.height);
  return {
    width: Math.min(LANDSCAPE_MAX_W, Math.floor(vw / scale)),
    height: Math.min(LANDSCAPE_MAX_H, Math.floor(vh / scale)),
    scale,
    mode: 'landscape',
  };
};

/** Elige el mayor factor entero n que deja al menos PORTRAIT_MIN_W × PORTRAIT_MIN_H internos */
const portrait = (vw: number, vh: number, dpr: number): StageSize | null => {
  const devW = vw * dpr;
  const devH = vh * dpr;
  for (let n = Math.floor(devW / PORTRAIT_MIN_W); n >= 1; n--) {
    const width = Math.floor(devW / n);
    const height = Math.floor(devH / n);
    if (width > PORTRAIT_MAX_W) break;
    if (height >= PORTRAIT_MIN_H) return { width, height, scale: n / dpr, mode: 'portrait' };
  }
  // Pantalla rara: ajuste exacto en lugar de entero
  const scale = vw / PORTRAIT_MIN_W;
  const height = Math.floor(vh / scale);
  return height >= PORTRAIT_MIN_H ? { width: PORTRAIT_MIN_W, height, scale, mode: 'portrait' } : null;
};

let cached: StageSize = LANDSCAPE_STAGE;
const computeStage = (): StageSize => {
  const dpr = window.devicePixelRatio || 1;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const next = (vh > vw * PORTRAIT_RATIO && portrait(vw, vh, dpr)) || landscape(vw, vh, dpr);
  // Misma referencia si nada cambia (requisito de useSyncExternalStore)
  if (next.width !== cached.width || next.height !== cached.height || next.scale !== cached.scale || next.mode !== cached.mode) {
    cached = next;
  }
  return cached;
};

const subscribeResize = (cb: () => void) => {
  window.addEventListener('resize', cb);
  window.addEventListener('orientationchange', cb);
  return () => {
    window.removeEventListener('resize', cb);
    window.removeEventListener('orientationchange', cb);
  };
};

const getServerStage = () => LANDSCAPE_STAGE;

// --- CONTEXTO: tamaño del escenario y distribuciones derivadas ---
const StageContext = createContext<StageSize>(LANDSCAPE_STAGE);

export const useStage = () => useContext(StageContext);
export const useGameLayout = () => {
  const stage = useStage();
  return useMemo(() => computeGameLayout(stage), [stage]);
};
export const useMenuLayout = () => {
  const stage = useStage();
  return useMemo(() => computeMenuLayout(stage), [stage]);
};

/**
 * Cámara: sacudida con amortiguación (decae suave), "punch" de zoom y flash.
 * Lo disparan los efectos de juego a través de fxStore.
 */
const useCamera = () => {
  const camera = useAnimationControls();
  const shake = useFxStore(s => s.shake);
  const punch = useFxStore(s => s.punch);

  useEffect(() => {
    if (!shake) return;
    const i = shake.intensity;
    camera.start({
      x: [0, -i, i * 0.8, -i * 0.55, i * 0.35, -i * 0.15, 0],
      y: [0, i * 0.6, -i * 0.5, i * 0.35, -i * 0.2, 0, 0],
      rotate: [0, -i * 0.12, i * 0.1, -i * 0.05, 0, 0, 0],
      transition: { duration: 0.08 + i * 0.05, ease: 'easeOut' },
    });
  }, [shake, camera]);

  useEffect(() => {
    if (!punch) return;
    camera.start({ scale: [1, 1 + punch.intensity, 1], transition: { duration: 0.35, times: [0, 0.2, 1], ease: 'easeOut' } });
  }, [punch, camera]);

  return camera;
};

/**
 * Cámara de pelea: se acerca suavemente a un punto, aguanta y vuelve. Va en su propia
 * capa para no pisarse con la sacudida y el "punch" de la cámara de impacto.
 */
const useFocus = () => {
  const controls = useAnimationControls();
  const focus = useFxStore(s => s.focus);
  const { width, height } = useContext(StageContext);
  useEffect(() => {
    if (!focus) return;
    const ox = Math.max(0.2, Math.min(0.8, focus.x / width));
    const oy = Math.max(0.2, Math.min(0.8, focus.y / height));
    controls.set({ originX: ox, originY: oy });
    controls.start({
      scale: [1, focus.zoom, focus.zoom, 1],
      transition: { duration: focus.seconds, times: [0, 0.3, 0.72, 1], ease: 'easeInOut' },
    });
  }, [focus, controls, width, height]);
  return controls;
};

const FocusLayer = ({ children }: { children: ReactNode }) => {
  const focus = useFocus();
  return <motion.div animate={focus} className="absolute inset-0">{children}</motion.div>;
};

const Flash = () => {
  const flash = useFxStore(s => s.flash);
  if (!flash) return null;
  return (
    <motion.div
      key={flash.id}
      className="absolute inset-0 pointer-events-none z-[999]"
      style={{ background: 'var(--c-white)' }}
      initial={{ opacity: flash.intensity }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    />
  );
};

export const Stage = ({ children }: { children: ReactNode }) => {
  const stage = useSyncExternalStore(subscribeResize, computeStage, getServerStage);
  const { width, height, scale } = stage;
  const camera = useCamera();

  return (
    <StageContext.Provider value={stage}>
      <div
        className="fixed inset-0 flex items-center justify-center overflow-clip"
        style={{ background: 'var(--ink-black)' }}
      >
        <div style={{ width: width * scale, height: height * scale, position: 'relative' }}>
          <div
            className="stage absolute left-0 top-0 overflow-clip"
            style={{ width, height, transform: `scale(${scale})`, transformOrigin: '0 0', background: 'var(--c-outline)' }}
          >
            {/* Los gestos (arrastrar) se miden en píxeles de pantalla: los pasamos a
                píxeles internos dividiendo por la escala del escenario */}
            <MotionConfig transformPagePoint={p => ({ x: p.x / scale, y: p.y / scale })}>
              <motion.div animate={camera} className="absolute inset-0">
                <FocusLayer>{children}</FocusLayer>
              </motion.div>
            </MotionConfig>
            <Flash />
            {/* Postprocesado de película: viñeta + grano (siempre por encima de todo) */}
            <div className="vignette absolute inset-0 pointer-events-none z-[996]" />
            <FilmGrain scale={scale} />
          </div>
        </div>
      </div>
    </StageContext.Provider>
  );
};
