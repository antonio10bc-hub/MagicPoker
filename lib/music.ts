// --- MÚSICA GENERATIVA: WESTERN NOCTURNO EN CINTA ---
// Sin archivos: se compone en tiempo real con Web Audio, siempre distinta y en bucle
// infinito sin costuras. Capas:
//  · bordón grave (raíz + quinta) que respira despacio y sigue una progresión lenta;
//  · guitarra con trémolo y mucha reverb: frases sueltas sobre una escala menor con
//    segunda menor (color "desierto"), con silencios largos;
//  · pulso sordo, como un corazón o un tambor lejano (solo en partida);
//  · cinta: siseo, una leve saturación y un temblor de tono (wow).
// En la pelea sube la "temperatura": el pulso se acelera, el bordón suma una segunda
// menor tensa y el filtro se abre.

export type MusicStyle = 'menu' | 'game';

export interface MusicHandle {
  stop: (fadeSeconds: number) => void;
  /** 0 = calma, 1 = pelea */
  setHeat: (heat: number) => void;
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

// La menor con segunda menor (frigio): La Si♭ Do Re Mi Fa Sol
const SCALE = [57, 58, 60, 62, 64, 65, 67, 69, 72, 74, 76];
/** Progresión del bordón (raíces MIDI), un acorde cada 4 compases */
const ROOTS = [45, 41, 43, 40];

const STYLE = {
  menu: { bpm: 58, noteChance: 0.3, pulse: false, gain: 1 },
  game: { bpm: 70, noteChance: 0.4, pulse: true, gain: 0.85 },
} as const;

let noise: AudioBuffer | null = null;
const noiseBuffer = (ctx: AudioContext) => {
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
};

/** Respuesta de sala sintética: ruido estéreo que se apaga en ~3 s */
const impulse = (ctx: AudioContext, seconds = 3.2) => {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return buf;
};

const tapeCurve = () => {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6);
  }
  return curve;
};

export const startMusic = (ctx: AudioContext, out: AudioNode, style: MusicStyle, volume: number): MusicHandle => {
  const cfg = STYLE[style];
  const t0 = ctx.currentTime;
  const nodes: AudioScheduledSourceNode[] = [];

  // --- Bus: saturación de cinta → temblor (wow) → salida, con reverb en paralelo
  const bus = ctx.createGain();
  bus.gain.setValueAtTime(0, t0);
  bus.gain.linearRampToValueAtTime(volume * cfg.gain, t0 + 2.5);
  const shaper = ctx.createWaveShaper();
  shaper.curve = tapeCurve();
  const wow = ctx.createDelay(0.05);
  wow.delayTime.value = 0.012;
  const wowLfo = ctx.createOscillator();
  wowLfo.frequency.value = 0.45;
  const wowDepth = ctx.createGain();
  wowDepth.gain.value = 0.0018;
  wowLfo.connect(wowDepth).connect(wow.delayTime);
  wowLfo.start();
  nodes.push(wowLfo);
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2600;
  shaper.connect(wow).connect(tone).connect(bus).connect(out);

  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.55;
  reverb.connect(wet).connect(bus);

  // --- Siseo de cinta
  const hiss = ctx.createBufferSource();
  hiss.buffer = noiseBuffer(ctx);
  hiss.loop = true;
  const hissHp = ctx.createBiquadFilter();
  hissHp.type = 'highpass';
  hissHp.frequency.value = 4000;
  const hissGain = ctx.createGain();
  hissGain.gain.value = 0.012;
  hiss.connect(hissHp).connect(hissGain).connect(bus);
  hiss.start();
  nodes.push(hiss);

  // --- Bordón: dos osciladores por voz, ligeramente desafinados, que respiran
  const droneFilter = ctx.createBiquadFilter();
  droneFilter.type = 'lowpass';
  droneFilter.frequency.value = 320;
  droneFilter.Q.value = 2;
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.12;
  const breath = ctx.createOscillator();
  breath.frequency.value = 0.06;
  const breathDepth = ctx.createGain();
  breathDepth.gain.value = 0.05;
  breath.connect(breathDepth).connect(droneGain.gain);
  breath.start();
  nodes.push(breath);
  droneFilter.connect(droneGain).connect(shaper);
  droneGain.connect(reverb);
  const droneVoices = [0, 7, 1].map((interval, i) => {
    const g = ctx.createGain();
    // La segunda menor (tensión) solo suena con calor
    g.gain.value = i === 2 ? 0 : i === 0 ? 0.5 : 0.3;
    g.connect(droneFilter);
    const oscs = [-6, 6].map(detune => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sawtooth' : 'triangle';
      o.detune.value = detune;
      o.frequency.value = midi(ROOTS[0] + interval);
      o.connect(g);
      o.start();
      nodes.push(o);
      return o;
    });
    return { interval, gain: g, oscs };
  });

  let heat = 0;

  // --- Guitarra con trémolo: una nota = dos osciladores + filtro con envolvente
  const pluck = (when: number, note: number, accent: number) => {
    const f = midi(note);
    const g = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = 3;
    filt.frequency.setValueAtTime(2800 + heat * 1500, when);
    filt.frequency.exponentialRampToValueAtTime(500, when + 1.6);
    const peak = 0.11 * accent;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 2.6);
    // Trémolo (amplitud) típico de guitarra de western
    const trem = ctx.createGain();
    trem.gain.value = 1;
    const tremLfo = ctx.createOscillator();
    tremLfo.frequency.value = 5.2;
    const tremDepth = ctx.createGain();
    tremDepth.gain.value = 0.35;
    tremLfo.connect(tremDepth).connect(trem.gain);
    const pan = ctx.createStereoPanner();
    pan.pan.value = (Math.random() * 2 - 1) * 0.4;
    [['triangle', 0], ['sawtooth', 7]].forEach(([type, detune]) => {
      const o = ctx.createOscillator();
      o.type = type as OscillatorType;
      o.frequency.value = f;
      o.detune.value = detune as number;
      o.connect(filt);
      o.start(when);
      o.stop(when + 2.7);
    });
    tremLfo.start(when);
    tremLfo.stop(when + 2.7);
    filt.connect(g).connect(trem).connect(pan);
    pan.connect(shaper);
    pan.connect(reverb);
  };

  // --- Pulso sordo
  const thump = (when: number, level: number) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(70, when);
    o.frequency.exponentialRampToValueAtTime(38, when + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.35 * level, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.35);
    o.connect(g).connect(shaper);
    o.start(when);
    o.stop(when + 0.4);
  };

  // --- Secuenciador con margen de anticipación (no depende del ritmo de la página)
  const beat = 60 / cfg.bpm;
  let nextTime = t0 + 0.8;
  let step = 0; // corcheas
  let cursor = 4; // posición en la escala (paseo aleatorio)
  const tick = () => {
    const horizon = ctx.currentTime + 0.4;
    while (nextTime < horizon) {
      const bar = Math.floor(step / 8);
      // Cambio de acorde cada 4 compases: el bordón se desliza a la nueva raíz
      if (step % 32 === 0) {
        const root = ROOTS[(bar / 4) % ROOTS.length];
        droneVoices.forEach(v => v.oscs.forEach(o => o.frequency.setTargetAtTime(midi(root + v.interval), nextTime, 0.8)));
      }
      const onBeat = step % 2 === 0;
      // Guitarra: frases cortas con silencios; más notas en tiempo fuerte
      const chance = cfg.noteChance * (onBeat ? 1 : 0.35) * (1 + heat * 0.5);
      if (Math.random() < chance) {
        cursor = Math.max(0, Math.min(SCALE.length - 1, cursor + Math.round((Math.random() * 2 - 1) * 2)));
        pluck(nextTime, SCALE[cursor] - (Math.random() < 0.25 ? 12 : 0), onBeat ? 1 : 0.6);
        // A veces una nota doble (quinta abajo), como un rasgueo suave
        if (onBeat && Math.random() < 0.2) pluck(nextTime + 0.03, SCALE[Math.max(0, cursor - 4)], 0.5);
      }
      if (cfg.pulse) {
        const beatInBar = (step % 8) / 2;
        const every = heat > 0.5 ? 1 : 2;
        if (onBeat && beatInBar % every === 0) thump(nextTime, 0.5 + heat * 0.5);
      }
      nextTime += beat / 2;
      step++;
    }
  };
  tick();
  const timer = setInterval(tick, 150);

  return {
    setHeat: (h: number) => {
      heat = Math.max(0, Math.min(1, h));
      const t = ctx.currentTime;
      droneVoices[2].gain.gain.setTargetAtTime(heat * 0.25, t, 0.6);
      droneFilter.frequency.setTargetAtTime(320 + heat * 500, t, 0.6);
      tone.frequency.setTargetAtTime(2600 + heat * 1800, t, 0.6);
    },
    stop: (fade: number) => {
      clearInterval(timer);
      const t = ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0, t + fade);
      nodes.forEach(n => { try { n.stop(t + fade + 0.1); } catch { /* ya parado */ } });
      setTimeout(() => bus.disconnect(), (fade + 3.5) * 1000);
    },
  };
};
