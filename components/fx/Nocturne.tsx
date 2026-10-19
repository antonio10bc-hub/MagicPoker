import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useStage } from '@/components/pixel/Stage';

// --- FONDO: LADERA NOCTURNA CON NIEBLA ---
// Cielo negro como espacio negativo, una ladera inclinada de grano frío y una banda de
// niebla crema que se arrastra a ras de suelo. Todo se pinta con tramado estocástico:
// cada píxel elige una tinta según su luminancia más un umbral aleatorio, así los
// degradados son densidad de puntos, nunca rampas limpias. El mapa de umbrales se
// renueva poco a poco (boil lento) en lugar de parpadear.
// En la pelea la niebla se calienta: aparecen brasas naranjas con transición musgo.

const FPS = 10;
/** Fracción de umbrales que se renueva en cada fotograma */
const BOIL = 0.12;

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/** Rampa de luminancia: negro → pizarra → teal → menta → crema */
const RAMP: RGB[] = ['#0B0D0C', '#1E2A28', '#5E7A76', '#B9CFC8', '#EDEBE0'].map(hex);
const ORANGE = hex('#FF4A1C');
const EMBER = hex('#F2652A');
const MOSS = hex('#6F8F5A');

export const Nocturne = () => {
  const { width, height } = useStage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fighting = useGameStore(s => s.phase === 'combat' || s.phase === 'combat-reveal');
  const fightRef = useRef(fighting);

  useEffect(() => { fightRef.current = fighting; }, [fighting]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const w = width;
    const h = height;
    canvas.width = w;
    canvas.height = h;
    const img = ctx.createImageData(w, h);
    const thresholds = new Float32Array(w * h).map(() => Math.random());
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let last = 0;
    let time = 0;
    let heat = fightRef.current ? 1 : 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 1000 / FPS) return;
      const dt = Math.min(0.2, (now - last) / 1000);
      last = now;
      time += dt;
      heat += ((fightRef.current ? 1 : 0) - heat) * Math.min(1, dt * 2);

      const boil = Math.floor(w * h * BOIL);
      for (let k = 0; k < boil; k++) thresholds[Math.floor(Math.random() * w * h)] = Math.random();

      const data = img.data;
      const fogW = h * 0.13;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const fx = x / w;
          // Ladera que baja hacia la derecha; por encima, negro
          const ridge = h * (0.26 + 0.22 * fx) + Math.sin(fx * 7 + 1.3) * 4;
          let v = 0.02;
          if (y > ridge) {
            const depth = (y - ridge) / h;
            v = 0.18 + 0.06 * Math.sin(x * 0.021 + y * 0.013 + 0.7) * Math.sin(y * 0.017 - x * 0.009) + depth * 0.14;
          }
          // Niebla: banda diagonal que respira y se arrastra
          const fogY = h * (0.5 + 0.18 * fx) + Math.sin(time * 0.35 + x * 0.025) * 6;
          const d = (y - fogY) / fogW;
          const swirl = 0.7 + 0.3 * Math.sin(x * 0.045 - time * 0.5 + y * 0.03) * Math.sin(y * 0.02 + time * 0.25);
          const fog = Math.exp(-d * d) * swirl * (y > ridge - 6 ? 1 : 0.25);
          v = v + fog * (0.92 - v);

          const i = y * w + x;
          const t = thresholds[i];
          const level = Math.max(0, Math.min(4, Math.floor(v * 4 + t * 0.95 - 0.2)));
          let c = RAMP[level];
          // Pelea: la niebla brilla en naranja (halación) con borde musgo
          if (heat > 0.02 && fog > 0.3) {
            const p = heat * (fog - 0.3) * 1.1;
            if (t < p * 0.55) c = t < p * 0.25 ? ORANGE : EMBER;
            else if (t > 1 - p * 0.18) c = MOSS;
          }
          const j = i * 4;
          data[j] = c[0]; data[j + 1] = c[1]; data[j + 2] = c[2]; data[j + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      if (reduced) cancelAnimationFrame(raf);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute left-0 top-0"
      // Escalado suave: los puntos se funden como tinta, no son píxeles duros
      style={{ width, height, imageRendering: 'auto', filter: 'blur(0.35px)' }}
      aria-hidden
    />
  );
};
