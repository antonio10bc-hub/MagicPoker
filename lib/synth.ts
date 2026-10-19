// --- EFECTOS SINTETIZADOS: WESTERN NOCTURNO EN CINTA ---
// La misma paleta que la música (lib/music.ts): cuerdas apagadas con trémolo, madera,
// golpes sordos, campanas lejanas, ruido de cinta y una sala con reverb compartida.
// Nada de ondas cuadradas brillantes: todo pasa por filtros paso bajo.
// Notas en La frigio (La Si♭ Do Re Mi Fa Sol), como la música.
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

// --- SALA: reverb compartida por salida (se crea una vez) ---
const rooms = new WeakMap<AudioNode, AudioNode>();
const room = (ctx: AudioContext, out: AudioNode) => {
  let send = rooms.get(out);
  if (!send) {
    const len = Math.floor(ctx.sampleRate * 2.4);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    const dark = ctx.createBiquadFilter();
    dark.type = 'lowpass';
    dark.frequency.value = 2400;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    conv.connect(dark).connect(wet).connect(out);
    send = conv;
    rooms.set(out, send);
  }
  return send;
};

/** Envolvente: ataque rápido y caída exponencial */
const envelope = (gain: GainNode, peak: number, start: number, attack: number, decay: number) => {
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
};

/** Conecta a la salida directa y, si se pide, a la sala */
const route = (ctx: AudioContext, node: AudioNode, out: AudioNode, reverb: number) => {
  node.connect(out);
  if (reverb > 0) {
    const send = ctx.createGain();
    send.gain.value = reverb;
    node.connect(send).connect(room(ctx, out));
  }
};

interface ToneOpts {
  type?: OscillatorType;
  from: number;
  to?: number;
  start?: number;
  attack?: number;
  decay: number;
  peak: number;
  /** Corte del paso bajo (por defecto, sin filtro) */
  cutoff?: number;
  reverb?: number;
}

const tone = (ctx: AudioContext, out: AudioNode, o: ToneOpts) => {
  const t = ctx.currentTime + (o.start ?? 0);
  const attack = o.attack ?? 0.005;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.from, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + attack + o.decay);
  const gain = ctx.createGain();
  envelope(gain, o.peak, t, attack, o.decay);
  let node: AudioNode = osc;
  if (o.cutoff) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.cutoff;
    node = osc.connect(f);
  }
  node.connect(gain);
  route(ctx, gain, out, o.reverb ?? 0);
  osc.start(t);
  osc.stop(t + attack + o.decay + 0.05);
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
  reverb?: number;
}

const noise = (ctx: AudioContext, out: AudioNode, o: NoiseOpts) => {
  const t = ctx.currentTime + (o.start ?? 0);
  const attack = o.attack ?? 0.005;
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = o.filter ?? 'bandpass';
  filter.Q.value = o.q ?? 1;
  filter.frequency.setValueAtTime(o.from, t);
  if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, t + attack + o.decay);
  const gain = ctx.createGain();
  envelope(gain, o.peak, t, attack, o.decay);
  src.connect(filter).connect(gain);
  route(ctx, gain, out, o.reverb ?? 0);
  src.start(t, Math.random() * 0.5);
  src.stop(t + attack + o.decay + 0.05);
};

/**
 * Cuerda punteada y apagada (como la guitarra de la música): dos osciladores
 * desafinados por un paso bajo que se cierra, con trémolo opcional.
 */
const pluck = (ctx: AudioContext, out: AudioNode, f: number, o: { start?: number; peak: number; decay?: number; tremolo?: boolean; reverb?: number; bright?: number }) => {
  const t = ctx.currentTime + (o.start ?? 0);
  const decay = o.decay ?? 0.9;
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.Q.value = 2.5;
  filt.frequency.setValueAtTime(o.bright ?? 2600, t);
  filt.frequency.exponentialRampToValueAtTime(380, t + decay);
  const gain = ctx.createGain();
  envelope(gain, o.peak, t, 0.006, decay);
  [['triangle', 0], ['sawtooth', 8]].forEach(([type, detune]) => {
    const osc = ctx.createOscillator();
    osc.type = type as OscillatorType;
    osc.frequency.value = f;
    osc.detune.value = detune as number;
    osc.connect(filt);
    osc.start(t);
    osc.stop(t + decay + 0.1);
  });
  let node: AudioNode = filt.connect(gain);
  if (o.tremolo) {
    const trem = ctx.createGain();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.4;
    const depth = ctx.createGain();
    depth.gain.value = 0.4;
    lfo.connect(depth).connect(trem.gain);
    lfo.start(t);
    lfo.stop(t + decay + 0.1);
    node = node.connect(trem);
  }
  route(ctx, node, out, o.reverb ?? 0.35);
};

/** Campana lejana: parciales inarmónicos de seno con caída larga */
const bell = (ctx: AudioContext, out: AudioNode, f: number, o: { start?: number; peak: number; decay?: number; reverb?: number }) => {
  [[1, 1], [2.76, 0.35], [5.4, 0.12]].forEach(([ratio, level]) =>
    tone(ctx, out, { from: f * ratio, start: o.start, attack: 0.004, decay: (o.decay ?? 1.4) / ratio ** 0.4, peak: o.peak * level, reverb: o.reverb ?? 0.6 }));
};

/** Golpe sordo de tambor de cuero (bombo lejano) */
const drum = (ctx: AudioContext, out: AudioNode, o: { start?: number; peak: number; from?: number; decay?: number; reverb?: number }) => {
  tone(ctx, out, { from: o.from ?? 95, to: 42, start: o.start, attack: 0.004, decay: o.decay ?? 0.45, peak: o.peak, reverb: o.reverb ?? 0.3 });
  noise(ctx, out, { filter: 'lowpass', from: 700, start: o.start, decay: 0.06, peak: o.peak * 0.35 });
};

/** Toque de madera (clic de interfaz, fichas) */
const wood = (ctx: AudioContext, out: AudioNode, f: number, peak: number, start = 0) => {
  tone(ctx, out, { from: f, to: f * 0.8, start, attack: 0.002, decay: 0.05, peak, cutoff: 2400 });
  noise(ctx, out, { from: f * 2.2, q: 6, start, attack: 0.001, decay: 0.025, peak: peak * 0.6 });
};

// Notas (Hz) en La frigio
const N = { A2: 110, Bb2: 116.5, C3: 130.8, D3: 146.8, E3: 164.8, F3: 174.6, G3: 196, A3: 220, Bb3: 233.1, C4: 261.6, D4: 293.7, E4: 329.6, F4: 349.2, G4: 392, A4: 440, C5: 523.3, E5: 659.3, A5: 880 };

export const SYNTHS = {
  /** Pasar por encima de algo pulsable: roce de madera casi inaudible */
  hover: (ctx, out, v, p) => noise(ctx, out, { from: 2600 * p, q: 5, attack: 0.002, decay: 0.03, peak: 0.05 * v }),
  /** Clic de interfaz: toque de madera */
  tick: (ctx, out, v, p) => wood(ctx, out, 900 * p, 0.22 * v),
  /** Seleccionar carta: cuerda punteada que sube (La → Mi) */
  select: (ctx, out, v, p) => {
    pluck(ctx, out, N.A3 * p, { peak: 0.13 * v, decay: 0.5 });
    pluck(ctx, out, N.E4 * p, { start: 0.05, peak: 0.1 * v, decay: 0.6 });
  },
  /** Deseleccionar: la misma cuerda que baja (Mi → Si♭, la segunda frigia) */
  deselect: (ctx, out, v, p) => {
    pluck(ctx, out, N.E4 * p, { peak: 0.1 * v, decay: 0.4 });
    pluck(ctx, out, N.Bb3 * p, { start: 0.05, peak: 0.08 * v, decay: 0.5 });
  },
  /** Robar carta: roce de papel */
  draw: (ctx, out, v, p) => noise(ctx, out, { filter: 'lowpass', from: 1200 * p, to: 3400 * p, q: 0.8, attack: 0.03, decay: 0.12, peak: 0.16 * v }),
  /** Carta en vuelo: aire */
  whoosh: (ctx, out, v, p) => noise(ctx, out, { filter: 'lowpass', from: 1800 * p, to: 400 * p, q: 0.7, attack: 0.05, decay: 0.18, peak: 0.16 * v, reverb: 0.2 }),
  /** Carta aterriza en el tapete: golpe blando y roce */
  place: (ctx, out, v, p) => {
    tone(ctx, out, { from: 120 * p, to: 58, attack: 0.003, decay: 0.16, peak: 0.45 * v, reverb: 0.15 });
    noise(ctx, out, { filter: 'lowpass', from: 900, decay: 0.07, peak: 0.22 * v });
  },
  /** Voltear carta: chasquido seco de cartulina */
  flip: (ctx, out, v, p) => noise(ctx, out, { from: 1800 * p, q: 2.5, attack: 0.002, decay: 0.05, peak: 0.2 * v, reverb: 0.15 }),
  /** Embestida: ráfaga de viento */
  swing: (ctx, out, v, p) => noise(ctx, out, { filter: 'lowpass', from: 2400 * p, to: 300 * p, q: 0.8, attack: 0.04, decay: 0.2, peak: 0.18 * v, reverb: 0.25 }),
  /** Choque sin bajas: golpe de madera hueca */
  hit: (ctx, out, v, p) => {
    tone(ctx, out, { from: 170 * p, to: 90, attack: 0.002, decay: 0.12, peak: 0.35 * v, reverb: 0.2 });
    wood(ctx, out, 420 * p, 0.12 * v);
  },
  /** Carta destruida: bombo y un desmoronarse de grano */
  crush: (ctx, out, v, p) => {
    drum(ctx, out, { peak: 0.6 * v, from: 110 * p, decay: 0.4, reverb: 0.35 });
    noise(ctx, out, { filter: 'lowpass', from: 2200 * p, to: 300, q: 0.6, start: 0.01, decay: 0.32, peak: 0.22 * v, reverb: 0.3 });
  },
  /** Golpe directo a un hueco vacío: cuerda grave que se dobla hacia abajo */
  zap: (ctx, out, v, p) => {
    tone(ctx, out, { type: 'sawtooth', from: N.A3 * p, to: N.A2 * p, attack: 0.004, decay: 0.35, peak: 0.12 * v, cutoff: 900, reverb: 0.4 });
    drum(ctx, out, { peak: 0.3 * v, decay: 0.25 });
  },
  /** Pierdes una vida: díada disonante grave (La + Si♭) y golpe */
  hurt: (ctx, out, v, p) => {
    pluck(ctx, out, N.A2 * p, { peak: 0.2 * v, decay: 1.3, tremolo: true, reverb: 0.5, bright: 1400 });
    pluck(ctx, out, N.Bb2 * p, { peak: 0.16 * v, decay: 1.3, tremolo: true, reverb: 0.5, bright: 1400 });
    drum(ctx, out, { peak: 0.55 * v, decay: 0.5 });
  },
  /** Le quitas una vida al rival: quinta que suena limpia y brilla */
  score: (ctx, out, v, p) => {
    pluck(ctx, out, N.A3 * p, { peak: 0.13 * v, decay: 1.1, tremolo: true, reverb: 0.5 });
    pluck(ctx, out, N.E4 * p, { start: 0.08, peak: 0.12 * v, decay: 1.2, tremolo: true, reverb: 0.5 });
    bell(ctx, out, N.A5 * p, { start: 0.12, peak: 0.04 * v, decay: 1.2 });
  },
  /** Empieza tu turno / nueva ronda: campana lejana */
  turn: (ctx, out, v, p) => bell(ctx, out, N.E5 * p, { peak: 0.07 * v, decay: 1.8, reverb: 0.8 }),
  /** Comienza la pelea: dos golpes de tambor y la cuerda grave con trémolo */
  fight: (ctx, out, v, p) => {
    drum(ctx, out, { peak: 0.7 * v, from: 100, decay: 0.55, reverb: 0.4 });
    drum(ctx, out, { start: 0.16, peak: 0.5 * v, from: 90, decay: 0.5, reverb: 0.4 });
    noise(ctx, out, { filter: 'lowpass', from: 300, to: 2600, q: 0.7, attack: 0.18, decay: 0.2, peak: 0.12 * v, reverb: 0.4 });
    pluck(ctx, out, N.A2 * p, { start: 0.05, peak: 0.2 * v, decay: 1.6, tremolo: true, reverb: 0.6, bright: 1800 });
  },
  /** El As limpia la mesa: aspiración de viento, golpe profundo y campanas */
  wipe: (ctx, out, v, p) => {
    noise(ctx, out, { filter: 'lowpass', from: 200, to: 5000, q: 0.6, attack: 0.3, decay: 0.3, peak: 0.28 * v, reverb: 0.5 });
    drum(ctx, out, { start: 0.28, peak: 0.85 * v, from: 70, decay: 0.9, reverb: 0.6 });
    [N.A4, N.C5, N.E5].forEach((f, i) => bell(ctx, out, f * p, { start: 0.32 + i * 0.07, peak: 0.05 * v, decay: 2 }));
  },
  /** Brillo (Joker, sello): campanitas en la escala */
  sparkle: (ctx, out, v, p) => [N.E5, N.A5, N.C5 * 2].forEach((f, i) => bell(ctx, out, f * p, { start: i * 0.06, peak: 0.035 * v, decay: 1.1 })),
  /** Latido (te queda una vida) */
  heartbeat: (ctx, out, v) => {
    tone(ctx, out, { from: 70, to: 45, decay: 0.12, peak: 0.6 * v });
    tone(ctx, out, { from: 65, to: 40, start: 0.16, decay: 0.14, peak: 0.45 * v });
  },
  /** Abrir panel / ventana: roce de tela */
  open: (ctx, out, v, p) => noise(ctx, out, { filter: 'lowpass', from: 700 * p, to: 2000 * p, q: 0.8, attack: 0.03, decay: 0.09, peak: 0.12 * v }),
  /** Confeti / premio: ficha de madera */
  pop: (ctx, out, v, p) => wood(ctx, out, 700 * p, 0.12 * v),
  /** Victoria: frase de guitarra con trémolo que sube y una campana */
  victory: (ctx, out, v, p) => {
    [N.A3, N.C4, N.E4, N.A4].forEach((f, i) => pluck(ctx, out, f * p, { start: i * 0.18, peak: 0.14 * v, decay: 1.6, tremolo: true, reverb: 0.6 }));
    pluck(ctx, out, N.E3 * p, { start: 0.72, peak: 0.1 * v, decay: 2.2, tremolo: true, reverb: 0.6 });
    bell(ctx, out, N.A5 * p, { start: 0.75, peak: 0.06 * v, decay: 2.4 });
    drum(ctx, out, { start: 0.72, peak: 0.4 * v, decay: 0.6 });
  },
  /** Derrota: la frase frigia que baja hasta el Si♭ y se queda colgando */
  defeat: (ctx, out, v, p) => {
    [N.E4, N.D4, N.C4, N.Bb3].forEach((f, i) => pluck(ctx, out, f * p, { start: i * 0.28, peak: 0.13 * v, decay: 1.5, tremolo: true, reverb: 0.65, bright: 1600 }));
    pluck(ctx, out, N.A2 * p, { start: 1.1, peak: 0.16 * v, decay: 2.6, tremolo: true, reverb: 0.7, bright: 1000 });
    drum(ctx, out, { start: 1.1, peak: 0.45 * v, decay: 0.8 });
  },
  /** Se revela un As: campana grave que se abre */
  reveal: (ctx, out, v, p) => {
    noise(ctx, out, { filter: 'lowpass', from: 300, to: 3000, q: 0.7, attack: 0.25, decay: 0.15, peak: 0.12 * v, reverb: 0.5 });
    bell(ctx, out, N.A4 * p, { start: 0.2, peak: 0.08 * v, decay: 2.2 });
    bell(ctx, out, N.E4 * p, { start: 0.2, peak: 0.06 * v, decay: 2.2 });
  },
} satisfies Record<string, Synth>;

export type SynthName = keyof typeof SYNTHS;
