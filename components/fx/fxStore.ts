import { create } from 'zustand';

// --- EFECTOS VISUALES TRANSITORIOS ---
// Cualquier componente puede lanzar partículas, textos flotantes u ondas de choque
// en coordenadas del escenario, y sacudir o "empujar" la cámara. Solo presentación:
// la lógica de juego no sabe nada de esto.

export type FxLayer = 'board' | 'ui';

interface Particle { dx: number; dy: number; rot: number; size: number; color: string; delay: number }

export type Effect =
  | { id: number; kind: 'particles'; layer: FxLayer; x: number; y: number; life: number; gravity: number; particles: Particle[] }
  | { id: number; kind: 'text'; layer: FxLayer; x: number; y: number; life: number; text: string; color: string; size: number }
  | { id: number; kind: 'ring'; layer: FxLayer; x: number; y: number; life: number; color: string; radius: number };

type NewEffect =
  | { kind: 'particles'; layer?: FxLayer; x: number; y: number; colors: string[]; count?: number; speed?: number; gravity?: number; size?: [number, number]; life?: number; spread?: number; angle?: number }
  | { kind: 'text'; layer?: FxLayer; x: number; y: number; text: string; color?: string; size?: number; life?: number }
  | { kind: 'ring'; layer?: FxLayer; x: number; y: number; color?: string; radius?: number; life?: number };

interface CameraKick { id: number; intensity: number }

interface FxState {
  effects: Effect[];
  shake: CameraKick | null;
  punch: CameraKick | null;
  flash: CameraKick | null;
  emit: (fx: NewEffect) => void;
  shakeCamera: (intensity?: number) => void;
  punchCamera: (amount?: number) => void;
  flashScreen: (opacity?: number) => void;
}

let nextId = 1;
const rand = (min: number, max: number) => min + Math.random() * (max - min);

const build = (fx: NewEffect): Effect => {
  const id = nextId++;
  const layer = fx.layer ?? 'board';
  if (fx.kind === 'text') {
    return { id, kind: 'text', layer, x: fx.x, y: fx.y, text: fx.text, color: fx.color ?? 'var(--c-white)', size: fx.size ?? 10, life: fx.life ?? 900 };
  }
  if (fx.kind === 'ring') {
    return { id, kind: 'ring', layer, x: fx.x, y: fx.y, color: fx.color ?? 'var(--c-white)', radius: fx.radius ?? 24, life: fx.life ?? 450 };
  }
  const count = fx.count ?? 10;
  const speed = fx.speed ?? 28;
  const spread = fx.spread ?? Math.PI * 2;
  const angle = fx.angle ?? -Math.PI / 2;
  const [minSize, maxSize] = fx.size ?? [1, 3];
  return {
    id, kind: 'particles', layer, x: fx.x, y: fx.y, life: fx.life ?? 650, gravity: fx.gravity ?? 40,
    particles: Array.from({ length: count }, () => {
      const a = angle + rand(-spread / 2, spread / 2);
      const v = speed * rand(0.4, 1);
      return {
        dx: Math.cos(a) * v, dy: Math.sin(a) * v, rot: rand(-180, 180),
        size: Math.round(rand(minSize, maxSize)), color: fx.colors[Math.floor(Math.random() * fx.colors.length)], delay: rand(0, 0.05),
      };
    }),
  };
};

export const useFxStore = create<FxState>((set, get) => ({
  effects: [],
  shake: null,
  punch: null,
  flash: null,
  emit: fx => {
    const effect = build(fx);
    set({ effects: [...get().effects, effect] });
    setTimeout(() => set({ effects: get().effects.filter(e => e.id !== effect.id) }), effect.life + 100);
  },
  shakeCamera: (intensity = 2) => set({ shake: { id: nextId++, intensity } }),
  punchCamera: (amount = 0.03) => set({ punch: { id: nextId++, intensity: amount } }),
  flashScreen: (opacity = 0.8) => set({ flash: { id: nextId++, intensity: opacity } }),
}));

/** Atajo para usar fuera de React (efectos de animación, callbacks) */
export const fx = {
  emit: (e: NewEffect) => useFxStore.getState().emit(e),
  shake: (intensity?: number) => useFxStore.getState().shakeCamera(intensity),
  punch: (amount?: number) => useFxStore.getState().punchCamera(amount),
  flash: (opacity?: number) => useFxStore.getState().flashScreen(opacity),
};
