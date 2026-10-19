import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useStage } from '@/components/pixel/Stage';

// --- FONDO EN REMOLINO ---
// Remolino psicodélico calculado píxel a píxel a 1/4 de la resolución interna y
// escalado sin suavizado: movimiento hipnótico de mesa de cartas + estética píxel.
// Se cuantiza en 4 bandas de color con tramado (dithering) en damero.
// En calma usa tonos fríos; durante la pelea gira más rápido y vira a rojo.

const DOWNSCALE = 4;
const FPS = 30;

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const CALM: RGB[] = ['#121A26', '#1B2A3E', '#26405C', '#2F5A78'].map(hex);
const FIGHT: RGB[] = ['#1E0B0E', '#3F1114', '#701A17', '#A8261C'].map(hex);

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export const Swirl = () => {
  const { width, height } = useStage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fighting = useGameStore(s => s.phase === 'combat' || s.phase === 'combat-reveal');
  const fightRef = useRef(fighting);

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
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let last = 0;
    let time = 0;
    let heat = fightRef.current ? 1 : 0; // 0 calma → 1 pelea (transición suave)
    const aspect = w / h;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 1000 / FPS) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      heat += ((fightRef.current ? 1 : 0) - heat) * Math.min(1, dt * 2.5);
      time += dt * (0.35 + heat * 1.1);

      const palette = CALM.map((c, i) => mix(c, FIGHT[i], heat));
      const data = img.data;
      for (let y = 0; y < h; y++) {
        const v = (y / h - 0.5) * 2;
        for (let x = 0; x < w; x++) {
          const u = (x / w - 0.5) * 2 * aspect;
          const r = Math.sqrt(u * u + v * v);
          const a = Math.atan2(v, u) + time * 0.6 + r * (2.4 + heat * 1.2);
          const n = Math.sin(a * 3 + r * 5 - time * 1.4) + 0.6 * Math.sin(r * 9 - time * 2 + a);
          // Tramado en damero para que las bandas se mezclen como pixel art
          const dither = (x + y) % 2 === 0 ? 0.18 : -0.18;
          const level = Math.max(0, Math.min(3, Math.floor(((n + 1.6) / 3.2) * 4 + dither)));
          const c = palette[level];
          const i = (y * w + x) * 4;
          data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
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
      style={{ width, height, imageRendering: 'pixelated' }}
      aria-hidden
    />
  );
};
