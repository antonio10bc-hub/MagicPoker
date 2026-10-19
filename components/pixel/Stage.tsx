import { createContext, ReactNode, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { STAGE } from '@/theme/tokens';
import { computeGameLayout, computeMenuLayout, LANDSCAPE_STAGE, StageSize } from '@/theme/layout';
import { useFxStore } from '@/components/fx/fxStore';
import { LETTERBOX_TILE, patternUri } from './patterns';

// --- ESCALADO ENTERO ---
// La escala se calcula en píxeles FÍSICOS (devicePixelRatio) para que cada píxel
// interno ocupe un número entero de píxeles reales.
//  - Horizontal: escenario fijo 384×288. Si el entero deja el juego por debajo del
//    80 % del hueco, se usa el ajuste exacto.
//  - Vertical (móvil): se elige el entero n que deja un ancho interno ≤ 260 px y el
//    alto interno se adapta a la pantalla, así el juego la llena entera.
const MIN_FILL = 0.8;
const PORTRAIT_MAX_W = 260;
const PORTRAIT_MIN_W = 200;
const PORTRAIT_MIN_H = 380;
const PORTRAIT_RATIO = 1.15; // alto / ancho a partir del cual se considera vertical

const landscape = (vw: number, vh: number, dpr: number): StageSize => {
  const fit = Math.min(vw / STAGE.width, vh / STAGE.height);
  const integer = Math.floor(fit * dpr) / dpr;
  const scale = integer >= fit * MIN_FILL && integer > 0 ? integer : fit;
  return { width: STAGE.width, height: STAGE.height, scale, mode: 'landscape' };
};

const portrait = (vw: number, vh: number, dpr: number): StageSize | null => {
  const devW = vw * dpr;
  const n = Math.max(1, Math.ceil(devW / PORTRAIT_MAX_W));
  let width = Math.floor(devW / n);
  let scale = n / dpr;
  if (width < PORTRAIT_MIN_W) {
    // Pantalla muy estrecha: ajuste exacto en lugar de entero
    width = PORTRAIT_MIN_W;
    scale = vw / width;
  }
  const height = Math.floor(vh / scale);
  return height >= PORTRAIT_MIN_H ? { width, height, scale, mode: 'portrait' } : null;
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
        className="fixed inset-0 flex items-center justify-center overflow-hidden"
        style={{ backgroundImage: patternUri('letterbox', LETTERBOX_TILE), backgroundSize: `${8 * scale}px` }}
      >
        <div style={{ width: width * scale, height: height * scale, position: 'relative' }}>
          <div
            className="stage absolute left-0 top-0 overflow-hidden"
            style={{ width, height, transform: `scale(${scale})`, transformOrigin: '0 0', background: 'var(--c-outline)' }}
          >
            <motion.div animate={camera} className="absolute inset-0">
              {children}
            </motion.div>
            <Flash />
          </div>
        </div>
      </div>
    </StageContext.Provider>
  );
};
