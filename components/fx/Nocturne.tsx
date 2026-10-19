import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useStage } from '@/components/pixel/Stage';
import { useSettings } from '@/hooks/useSettings';

// --- FONDO: NOCHE CON NIEBLA ---
// Negro como espacio negativo y una banda de niebla crema que se arrastra despacio
// detrás del tablero. Todo se pinta con tramado estocástico: cada píxel elige una
// tinta según su luminancia más un umbral aleatorio, así los degradados son densidad
// de puntos, nunca rampas limpias. El mapa de umbrales se renueva poco a poco (boil
// lento) en lugar de parpadear. En la pelea la niebla se calienta en naranja.
//
// Rendimiento: se calcula a media resolución interna, a 8 fps, y todo lo que no se
// mueve (forma de la banda, variación del suelo) se precalcula una sola vez. Por
// fotograma solo quedan sumas y una tabla de senos.

const DOWNSCALE = 2;
const FPS = 8;
/** Fracción de umbrales que se renueva en cada fotograma */
const BOIL = 0.1;

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/** Rampa de luminancia: negro → pizarra → teal → menta → crema */
const RAMP: RGB[] = ['#0B0D0C', '#1E2A28', '#5E7A76', '#B9CFC8', '#EDEBE0'].map(hex);
const ORANGE = hex('#FF4A1C');
const EMBER = hex('#F2652A');
const MOSS = hex('#6F8F5A');

const SIN_N = 1024;
const SIN = new Float32Array(SIN_N).map((_, i) => Math.sin((i / SIN_N) * Math.PI * 2));
const sin = (a: number) => SIN[((Math.floor((a / (Math.PI * 2)) * SIN_N) % SIN_N) + SIN_N) % SIN_N];

export const Nocturne = () => {
  const { width, height } = useStage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fighting = useGameStore(s => s.phase === 'combat' || s.phase === 'combat-reveal');
  const fightRef = useRef(fighting);
  // Modo rendimiento (grano apagado): la niebla se pinta una vez y queda quieta
  const still = useSettings().grain === 'off';

  useEffect(() => { fightRef.current = fighting; }, [fighting]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const w = Math.ceil(width / DOWNSCALE);
    const h = Math.ceil(height / DOWNSCALE);
    canvas.width = w;
    canvas.height = h;
    const img = ctx.createImageData(w, h);
    const data = img.data;
    const n = w * h;
    const thresholds = new Float32Array(n).map(() => Math.random());
    // Precalculado: luminancia de base (viñeta suave hacia el centro) y forma de la
    // banda de niebla (gaussiana alrededor del centro del tablero)
    const base = new Float32Array(n);
    const band = new Float32Array(n);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w - 0.5;
        const v = y / h - 0.55;
        base[y * w + x] = Math.max(0, 0.16 - (u * u + v * v) * 0.5);
        const d = (y / h - 0.56) / 0.17;
        band[y * w + x] = Math.exp(-d * d);
      }
    }
    for (let i = 3; i < n * 4; i += 4) data[i] = 255;
    const reduced = still || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let last = 0;
    let time = 0;
    let heat = fightRef.current ? 1 : 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 1000 / FPS) return;
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      time += dt;
      heat += ((fightRef.current ? 1 : 0) - heat) * Math.min(1, dt * 2);

      const boil = Math.floor(n * BOIL);
      for (let k = 0; k < boil; k++) thresholds[(Math.random() * n) | 0] = Math.random();

      const hot = heat > 0.02;
      for (let y = 0; y < h; y++) {
        const sy = sin(y * 0.04 + time * 0.25);
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const swirl = 0.68 + 0.32 * sin(x * 0.09 - time * 0.5 + y * 0.06) * sy;
          const fog = band[i] * swirl;
          const v = base[i] + fog * 0.45;
          const t = thresholds[i];
          let level = (v * 4 + t * 0.95 - 0.2) | 0;
          if (level < 0) level = 0; else if (level > 4) level = 4;
          let c = RAMP[level];
          // Pelea: la niebla brilla en naranja (halación) con borde musgo
          if (hot && fog > 0.3) {
            const p = heat * (fog - 0.3) * 1.1;
            if (t < p * 0.5) c = t < p * 0.22 ? ORANGE : EMBER;
            else if (t > 1 - p * 0.16) c = MOSS;
          }
          const j = i * 4;
          data[j] = c[0]; data[j + 1] = c[1]; data[j + 2] = c[2];
        }
      }
      ctx.putImageData(img, 0, 0);
      if (reduced) cancelAnimationFrame(raf);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [width, height, still]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute left-0 top-0"
      // Escalado suave: los puntos se funden como tinta, no son píxeles duros
      style={{ width, height, imageRendering: 'auto' }}
      aria-hidden
    />
  );
};
