// --- EFECTOS SINTETIZADOS (estilo chiptune de portátil) ---
// Cada efecto es una pequeña receta de osciladores y ruido con envolventes cortas.
// Se generan en tiempo real: cero archivos y cero latencia.

type Synth = (ctx: AudioContext, out: AudioNode, volume: number, pitch: number) => void;

let noiseBuffer: AudioBuffer | null = null;
const getNoise = (ctx: AudioContext) => {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
};

/** Envolvente: ataque rápido y caída exponencial */
const envelope = (ctx: AudioContext, gain: GainNode, peak: number, start: number, attack: number, decay: number) => {
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
};

interface ToneOpts {
  type?: OscillatorType;
  from: number;
  to?: number;
  start?: number;
  attack?: number;
  decay: number;
  peak: number;
}

const tone = (ctx: AudioContext, out: AudioNode, o: ToneOpts) => {
  const t = ctx.currentTime + (o.start ?? 0);
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'square';
  osc.frequency.setValueAtTime(o.from, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.attack ?? 0.005) + o.decay);
  const gain = ctx.createGain();
  envelope(ctx, gain, o.peak, t, o.attack ?? 0.005, o.decay);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + (o.attack ?? 0.005) + o.decay + 0.05);
};

interface NoiseOpts {
  filter?: BiquadFilterType;
  from: number;
  to?: number;
  q?: number;
  start?: number;
  attack?: number;
  decay: number;
  peak: number;
}

const noise = (ctx: AudioContext, out: AudioNode, o: NoiseOpts) => {
  const t = ctx.currentTime + (o.start ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = o.filter ?? 'bandpass';
  filter.Q.value = o.q ?? 1;
  filter.frequency.setValueAtTime(o.from, t);
  if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, t + (o.attack ?? 0.005) + o.decay);
  const gain = ctx.createGain();
  envelope(ctx, gain, o.peak, t, o.attack ?? 0.005, o.decay);
  src.connect(filter).connect(gain).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + (o.attack ?? 0.005) + o.decay + 0.05);
};

/** Arpegio de notas (Hz) */
const arpeggio = (ctx: AudioContext, out: AudioNode, notes: number[], step: number, peak: number, type: OscillatorType = 'square', decay = 0.12) =>
  notes.forEach((f, i) => tone(ctx, out, { type, from: f, start: i * step, decay, peak }));

export const SYNTHS = {
  /** Pasar el ratón por encima de algo pulsable */
  hover: (ctx, out, v, p) => tone(ctx, out, { from: 1800 * p, decay: 0.03, peak: 0.04 * v }),
  /** Seleccionar carta */
  select: (ctx, out, v, p) => arpeggio(ctx, out, [660 * p, 990 * p], 0.045, 0.09 * v, 'square', 0.07),
  /** Deseleccionar */
  deselect: (ctx, out, v, p) => arpeggio(ctx, out, [880 * p, 587 * p], 0.045, 0.07 * v, 'square', 0.06),
  /** Robar carta: siseo ascendente */
  draw: (ctx, out, v, p) => noise(ctx, out, { from: 900 * p, to: 4200 * p, q: 2, attack: 0.02, decay: 0.12, peak: 0.25 * v }),
  /** Carta en vuelo */
  whoosh: (ctx, out, v, p) => noise(ctx, out, { from: 3000 * p, to: 600 * p, q: 1.5, attack: 0.04, decay: 0.16, peak: 0.22 * v }),
  /** Carta aterriza en la mesa */
  place: (ctx, out, v, p) => {
    tone(ctx, out, { type: 'sine', from: 180 * p, to: 55, decay: 0.16, peak: 0.55 * v });
    noise(ctx, out, { filter: 'lowpass', from: 2400, decay: 0.05, peak: 0.25 * v });
  },
  /** Voltear carta */
  flip: (ctx, out, v, p) => {
    noise(ctx, out, { from: 2500 * p, to: 5000 * p, q: 3, decay: 0.05, peak: 0.18 * v });
    tone(ctx, out, { from: 1200 * p, to: 1600 * p, start: 0.02, decay: 0.04, peak: 0.05 * v });
  },
  /** Embestida de ataque */
  swing: (ctx, out, v, p) => noise(ctx, out, { from: 5000 * p, to: 500 * p, q: 0.8, attack: 0.03, decay: 0.12, peak: 0.2 * v }),
  /** Golpe entre cartas */
  hit: (ctx, out, v, p) => {
    noise(ctx, out, { filter: 'lowpass', from: 3000 * p, to: 300, decay: 0.12, peak: 0.45 * v });
    tone(ctx, out, { from: 220 * p, to: 70, decay: 0.12, peak: 0.25 * v });
  },
  /** Carta destruida: crujido + boom */
  crush: (ctx, out, v, p) => {
    noise(ctx, out, { filter: 'highpass', from: 1500 * p, decay: 0.18, peak: 0.35 * v });
    tone(ctx, out, { type: 'sine', from: 140 * p, to: 40, decay: 0.3, peak: 0.6 * v });
    tone(ctx, out, { type: 'sawtooth', from: 400 * p, to: 90, start: 0.02, decay: 0.15, peak: 0.12 * v });
  },
  /** Daño directo a un hueco vacío */
  zap: (ctx, out, v, p) => tone(ctx, out, { type: 'sawtooth', from: 1400 * p, to: 180 * p, decay: 0.2, peak: 0.16 * v }),
  /** Pierdes una vida */
  hurt: (ctx, out, v, p) => {
    arpeggio(ctx, out, [523 * p, 415 * p, 311 * p], 0.07, 0.14 * v, 'square', 0.12);
    tone(ctx, out, { type: 'sine', from: 90, to: 40, decay: 0.35, peak: 0.5 * v });
  },
  /** Le quitas una vida al rival */
  score: (ctx, out, v, p) => arpeggio(ctx, out, [523 * p, 659 * p, 784 * p, 1047 * p], 0.055, 0.12 * v, 'square', 0.1),
  /** Empieza tu turno / nueva ronda */
  turn: (ctx, out, v, p) => arpeggio(ctx, out, [392 * p, 523 * p, 659 * p], 0.07, 0.1 * v, 'triangle', 0.16),
  /** Comienza la pelea: tambor + barrido */
  fight: (ctx, out, v, p) => {
    tone(ctx, out, { type: 'sine', from: 160 * p, to: 45, decay: 0.4, peak: 0.8 * v });
    noise(ctx, out, { from: 300, to: 6000, q: 1.2, attack: 0.15, decay: 0.2, peak: 0.25 * v });
    arpeggio(ctx, out, [196 * p, 262 * p, 392 * p], 0.08, 0.1 * v, 'sawtooth', 0.18);
  },
  /** El As limpia el tablero */
  wipe: (ctx, out, v, p) => {
    noise(ctx, out, { from: 200, to: 8000, q: 0.7, attack: 0.25, decay: 0.35, peak: 0.35 * v });
    tone(ctx, out, { type: 'sine', from: 70, to: 30, start: 0.25, decay: 0.6, peak: 0.8 * v });
    arpeggio(ctx, out, [1047 * p, 1319 * p, 1568 * p, 2093 * p], 0.04, 0.06 * v, 'triangle', 0.25);
  },
  /** Brillo (Joker, logro) */
  sparkle: (ctx, out, v, p) => arpeggio(ctx, out, [1568 * p, 2093 * p, 2637 * p, 3136 * p], 0.035, 0.05 * v, 'triangle', 0.14),
  /** Latido (te queda una vida) */
  heartbeat: (ctx, out, v) => {
    tone(ctx, out, { type: 'sine', from: 70, to: 45, decay: 0.12, peak: 0.6 * v });
    tone(ctx, out, { type: 'sine', from: 65, to: 40, start: 0.16, decay: 0.14, peak: 0.45 * v });
  },
  /** Abrir panel / modal */
  open: (ctx, out, v, p) => noise(ctx, out, { from: 800 * p, to: 3000 * p, q: 4, attack: 0.02, decay: 0.08, peak: 0.12 * v }),
  /** Confeti / premio */
  pop: (ctx, out, v, p) => tone(ctx, out, { type: 'triangle', from: 900 * p, to: 1800 * p, decay: 0.06, peak: 0.08 * v }),
} satisfies Record<string, Synth>;

export type SynthName = keyof typeof SYNTHS;
