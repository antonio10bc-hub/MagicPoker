import { CSSProperties, useSyncExternalStore } from 'react';

// --- POSTPROCESADO: GRANO DE PELÍCULA ---
// Se calcula una vez una tira de 4 fotogramas de ruido (a resolución de pantalla, no
// de píxel interno) y se recorre a pocos fotogramas por segundo: "boil" lento, sin
// parpadeo. Dos capas:
//  · overlay: grano de luminancia fuerte que convierte cualquier degradado en
//    densidad de puntos;
//  · screen: motas sueltas crema / naranja / teal, que también salpican el negro
//    (el overlay no aclara el negro puro).

const SIZE = 192;
const FRAMES = 4;

type RGB = [number, number, number];
const SPECKS: RGB[] = [[237, 235, 224], [255, 74, 28], [94, 122, 118], [185, 207, 200]];

/** Generador determinista: el grano es el mismo en cada carga */
const rng = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const build = () => {
  const w = SIZE * FRAMES;
  const make = (paint: (data: Uint8ClampedArray, i: number, r: () => number) => void, seed: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const img = ctx.createImageData(w, SIZE);
    const r = rng(seed);
    for (let i = 0; i < w * SIZE; i++) paint(img.data, i * 4, r);
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL('image/png');
  };
  // Ruido con colas largas (suma de dos uniformes al cuadrado): mucho gris medio y
  // puntos muy claros/oscuros, como el grano de una emulsión forzada
  const luma = make((d, i, r) => {
    const n = (r() + r()) / 2 - 0.5;
    const v = 128 + Math.sign(n) * Math.pow(Math.abs(n) * 2, 0.8) * 127;
    d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
  }, 11);
  const specks = make((d, i, r) => {
    if (r() < 0.035) {
      const c = SPECKS[Math.floor(r() * SPECKS.length)];
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 150 + r() * 105;
    }
  }, 23);
  return luma && specks ? { luma, specks } : null;
};

let cached: ReturnType<typeof build> | undefined;
// El ruido solo existe en el navegador (canvas); en el servidor no se pinta
const getGrain = () => (cached === undefined ? (cached = build()) : cached);
const noSubscribe = () => () => {};

export const FilmGrain = ({ scale }: { scale: number }) => {
  const grain = useSyncExternalStore(noSubscribe, getGrain, () => null);
  if (!grain) return null;

  // El escenario se escala por `scale`: dividimos para que 1 punto de ruido = 1 px CSS
  const w = (SIZE * FRAMES) / scale;
  const h = SIZE / scale;
  const layer = (uri: string, blend: CSSProperties['mixBlendMode'], opacity: number, speed: number): CSSProperties => ({
    backgroundImage: `url(${uri})`,
    backgroundSize: `${w}px ${h}px`,
    mixBlendMode: blend,
    opacity,
    animation: `grain-boil ${speed}s steps(${FRAMES}) infinite`,
    '--grain-w': `${w}px`,
  } as CSSProperties);

  return (
    <>
      <div className="grain absolute inset-0 pointer-events-none z-[997]" style={layer(grain.luma, 'overlay', 0.6, 0.5)} />
      <div className="grain absolute inset-0 pointer-events-none z-[997]" style={layer(grain.specks, 'screen', 0.35, 0.62)} />
    </>
  );
};
