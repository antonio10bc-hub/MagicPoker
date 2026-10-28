import { CSSProperties, useSyncExternalStore } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useLowPower } from '@/lib/quality';

// --- POSTPROCESADO: GRANO DE PELÍCULA ---
// Un mosaico de ruido a resolución de pantalla (1 punto = 1 px CSS, no un píxel
// interno) que salta a posiciones distintas a ~8 fps: "boil" lento, sin parpadeo.
// El salto es un `transform` en una capa propia, así lo hace el compositor sin
// repintar nada. Dos capas:
//  · overlay: grano de luminancia fuerte que convierte cualquier degradado en
//    densidad de puntos;
//  · normal: motas sueltas crema / naranja / teal, que también salpican el negro
//    (el overlay no aclara el negro puro). Mezcla normal = barata.

const SIZE = 256;

type RGB = [number, number, number];
const SPECKS: RGB[] = [[237, 235, 224], [255, 74, 28], [94, 122, 118], [185, 207, 200]];

/** Generador determinista: el grano es el mismo en cada carga */
const rng = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const build = () => {
  const make = (paint: (data: Uint8ClampedArray, i: number, r: () => number) => void, seed: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const img = ctx.createImageData(SIZE, SIZE);
    const r = rng(seed);
    for (let i = 0; i < SIZE * SIZE; i++) paint(img.data, i * 4, r);
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL('image/png');
  };
  // Ruido con colas largas: mucho gris medio y puntos muy claros/oscuros, como el
  // grano de una emulsión forzada
  const luma = make((d, i, r) => {
    const n = (r() + r()) / 2 - 0.5;
    const v = 128 + Math.sign(n) * Math.pow(Math.abs(n) * 2, 0.8) * 127;
    d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
  }, 11);
  const specks = make((d, i, r) => {
    if (r() < 0.03) {
      const c = SPECKS[Math.floor(r() * SPECKS.length)];
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 60 + r() * 70;
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
  // Ajuste del jugador: grano completo, suave o apagado (modo rendimiento)
  const level = useSettings().grain;
  // En bajo consumo, fuera: mezclar a pantalla completa es lo que más cuesta a la GPU
  const lowPower = useLowPower();
  if (!grain || level === 'off' || lowPower) return null;
  const k = level === 'soft' ? 0.5 : 1;

  // El escenario se escala por `scale`: dividimos para que 1 punto de ruido = 1 px CSS.
  // La capa es un mosaico más grande que la pantalla para poder desplazarla.
  const tile = SIZE / scale;
  // Saltos a 4 desplazamientos del mosaico (fracciones "raras" para que no se note la
  // repetición), en px fijos para que la animación la haga el compositor
  const name = `grain-jump-${Math.round(tile * 100)}`;
  const at = (fx: number, fy: number) => `transform: translate(${(fx * tile).toFixed(2)}px, ${(fy * tile).toFixed(2)}px)`;
  const keyframes = `@keyframes ${name} { 0% { ${at(0, 0)} } 25% { ${at(-0.37, 0.61)} } 50% { ${at(0.53, -0.29)} } 75% { ${at(-0.71, -0.47)} } }`;
  const layer = (uri: string, speed: number): CSSProperties => ({
    left: -tile, top: -tile, right: -tile, bottom: -tile,
    backgroundImage: `url(${uri})`,
    backgroundSize: `${tile}px ${tile}px`,
    animation: `${name} ${speed}s steps(1) infinite`,
    willChange: 'transform',
  });
  // El modo de mezcla va en el contenedor: si fuera en la capa interior, el contenedor
  // (que recorta y apila) aislaría la mezcla y el grano taparía el juego
  const wrap = (blend: CSSProperties['mixBlendMode'], opacity: number): CSSProperties => ({ mixBlendMode: blend, opacity });

  return (
    <>
      <style>{keyframes}</style>
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-[997]" style={wrap('overlay', 0.6 * k)}>
        <div className="grain absolute" style={layer(grain.luma, 0.5)} />
      </div>
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-[997]" style={wrap('normal', k)}>
        <div className="grain absolute" style={layer(grain.specks, 0.62)} />
      </div>
    </>
  );
};
