// --- LA NANA DEL ENTE (música del prólogo) ---
// Una caja de música perdida en el bosque, en Re dórico y a ritmo de vals lento: arpegios
// de campanita (seno con sus armónicos, que se apagan) sobre un colchón de viento y una
// nota grave que respira. Suena seguida durante todo el prólogo: el paseo por el mapa y
// cada minipartida contra el ente, sin cortarse al entrar y salir (mismo tema y misma
// clave en lib/sounds). Capas:
//  · paseo (mapa): caja de música, viento y bordón.
//  · partida (setMatch): se suma un pulso sordo en el primer tiempo y un bajo de contrabajo
//    pellizcado, como pasos; la caja toca algo más.
//  · pelea (setHeat): la caja se ilumina y redobla; el viento sube.
import type { MusicHandle } from './music';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

// Re dórico: Re Mi Fa Sol La Si Do. Acordes del vals (raíces y triadas), uno por compás
const CHORDS: number[][] = [
  [50, 53, 57, 60], // Rem7
  [55, 59, 62, 65], // Sol7 (la sexta dórica, la luz)
  [48, 52, 55, 59], // Do maj7
  [50, 53, 57, 62], // Rem
  [53, 57, 60, 64], // Fa maj7
  [55, 59, 62, 65], // Sol7
  [57, 60, 64, 67], // Lam7
  [50, 53, 57, 60], // Rem7
];
const BPM = 54;

export const startWispMusic = (ctx: AudioContext, out: AudioNode, volume: number): MusicHandle & { setMatch: (on: boolean) => void } => {
  const t0 = ctx.currentTime;
  const nodes: AudioScheduledSourceNode[] = [];
  const bus = ctx.createGain();
  bus.gain.setValueAtTime(0, t0);
  bus.gain.linearRampToValueAtTime(volume, t0 + 3);
  bus.connect(out);

  // Sala grande y húmeda (el bosque de noche)
  const reverb = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 4.5);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  reverb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.7;
  reverb.connect(wet).connect(bus);
  const dry = ctx.createGain();
  dry.gain.value = 0.8;
  dry.connect(bus);

  // --- Viento: ruido rosado filtrado que sube y baja
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  {
    const d = noiseBuf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < d.length; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 3; }
  }
  const wind = ctx.createBufferSource();
  wind.buffer = noiseBuf;
  wind.loop = true;
  const windBand = ctx.createBiquadFilter();
  windBand.type = 'bandpass';
  windBand.frequency.value = 500;
  windBand.Q.value = 0.8;
  const windGain = ctx.createGain();
  windGain.gain.value = 0.05;
  const gust = ctx.createOscillator();
  gust.frequency.value = 0.07;
  const gustDepth = ctx.createGain();
  gustDepth.gain.value = 0.035;
  gust.connect(gustDepth).connect(windGain.gain);
  const gustF = ctx.createGain();
  gustF.gain.value = 260;
  gust.connect(gustF).connect(windBand.frequency);
  wind.connect(windBand).connect(windGain).connect(bus);
  windGain.connect(reverb);
  wind.start();
  gust.start();
  nodes.push(wind, gust);

  // --- Bordón: la raíz grave, dos senos casi iguales que baten despacio
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.06;
  droneGain.connect(dry);
  droneGain.connect(reverb);
  const drone = [-3, 3].map(det => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.detune.value = det;
    o.frequency.value = midi(CHORDS[0][0] - 12);
    o.connect(droneGain);
    o.start();
    nodes.push(o);
    return o;
  });

  let heat = 0;
  let match = 0; // 0 paseo, 1 partida (con fundido)

  // --- Campanita de caja de música: seno + armónicos que se apagan antes
  const bell = (when: number, note: number, level: number) => {
    const f = midi(note);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.09 * level, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 2.2);
    const pan = ctx.createStereoPanner();
    pan.pan.value = (Math.random() * 2 - 1) * 0.5;
    g.connect(pan);
    pan.connect(dry);
    pan.connect(reverb);
    [[1, 1, 2.2], [2.76, 0.35, 0.7], [5.4, 0.12, 0.35]].forEach(([mult, amp, dur]) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * mult;
      const og = ctx.createGain();
      og.gain.setValueAtTime(amp, when);
      og.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(og).connect(g);
      o.start(when);
      o.stop(when + dur + 0.05);
    });
  };

  // --- Bajo pellizcado (en partida): un pizzicato redondo
  const pizz = (when: number, note: number, level: number) => {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = midi(note);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(900, when);
    filt.frequency.exponentialRampToValueAtTime(200, when + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.22 * level, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.6);
    o.connect(filt).connect(g).connect(dry);
    o.start(when);
    o.stop(when + 0.7);
  };

  // --- Pulso sordo (en partida): un latido suave en el primer tiempo
  const thump = (when: number, level: number) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(64, when);
    o.frequency.exponentialRampToValueAtTime(40, when + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.28 * level, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
    o.connect(g).connect(dry);
    o.start(when);
    o.stop(when + 0.35);
  };

  // --- Secuenciador: vals (3 tiempos, en corcheas: 6 por compás)
  const eighth = 60 / BPM / 2;
  let nextTime = t0 + 1;
  let step = 0;
  let melody = 2; // índice en el acorde (paseo suave)
  const tick = () => {
    const horizon = ctx.currentTime + 0.4;
    while (nextTime < horizon) {
      const bar = Math.floor(step / 6);
      const inBar = step % 6;
      const chord = CHORDS[bar % CHORDS.length];
      if (inBar === 0) drone.forEach(o => o.frequency.setTargetAtTime(midi(chord[0] - 12), nextTime, 0.9));
      // Arpegio de la caja: en cada tiempo, y en las corcheas de en medio con calor
      const onBeat = inBar % 2 === 0;
      const busy = 0.25 + match * 0.25 + heat * 0.45;
      if (onBeat || Math.random() < busy * 0.6) {
        melody = Math.max(0, Math.min(chord.length * 2 - 1, melody + (Math.random() < 0.5 ? -1 : 1)));
        const note = chord[melody % chord.length] + 12 + (melody >= chord.length ? 12 : 0);
        // A veces calla (la caja de música se queda sin cuerda un instante)
        if (Math.random() > 0.12 - heat * 0.1) bell(nextTime, note, onBeat ? 1 : 0.55);
      }
      // En partida: pasos (bajo pellizcado en el 1 y el 3) y latido en el 1
      if (match > 0.5) {
        if (inBar === 0) { pizz(nextTime, chord[0] - 12, 1); thump(nextTime, 0.6 + heat * 0.4); }
        if (inBar === 4) pizz(nextTime, chord[2] - 12, 0.6);
        if (heat > 0.5 && inBar === 2) thump(nextTime, 0.4);
      }
      nextTime += eighth / (1 + heat * 0.12);
      step++;
    }
  };
  tick();
  const timer = setInterval(tick, 150);

  return {
    setHeat: (h: number) => {
      heat = Math.max(0, Math.min(1, h));
      windGain.gain.setTargetAtTime(0.05 + heat * 0.03, ctx.currentTime, 0.8);
    },
    setTension: () => { /* el ente no aprieta: sin cuerda tensa */ },
    setMatch: (on: boolean) => {
      match = on ? 1 : 0;
      droneGain.gain.setTargetAtTime(on ? 0.075 : 0.06, ctx.currentTime, 1);
    },
    stop: (fade: number) => {
      clearInterval(timer);
      const t = ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0, t + fade);
      nodes.forEach(n => { try { n.stop(t + fade + 0.1); } catch { /* ya parado */ } });
      setTimeout(() => bus.disconnect(), (fade + 5) * 1000);
    },
  };
};
