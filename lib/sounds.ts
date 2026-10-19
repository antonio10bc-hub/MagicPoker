// --- MOTOR DE AUDIO (Web Audio) ---
// Grafo:  sfx ──────────────┐
//         música → filtro ─→ duck ─→ master → altavoces
// - Los mp3 se decodifican una vez a buffers y se reproducen sin latencia.
// - Los efectos de juego se sintetizan (lib/synth.ts): sin assets nuevos.
// - La música se funde entre pistas, se "ahoga" con un paso bajo cuando hay un
//   modal abierto y baja de volumen un instante en los golpes fuertes (ducking).
// La API pública (playSound, playMusic, stopMusic, toggleMute...) no cambia.

import { SYNTHS, SynthName } from './synth';

const SFX_FILES = {
  click: 'click.mp3',
  defeat: 'defeat.mp3',
  shuffle: 'shuffle.mp3',
  victory: 'badassvictory.mp3',
  as_reveal: 'mild-surprise.mp3',
} as const;

const MUSIC_FILES = {
  menu_music: 'menuloop.mp3',
  game_music: 'loopsong.mp3',
} as const;

export type SoundName = keyof typeof SFX_FILES;
export type MusicName = keyof typeof MUSIC_FILES;
export type { SynthName } from './synth';

const isBrowser = () => typeof window !== 'undefined';

// --- ESTADO ---
let isMuted = false;
const muteListeners = new Set<() => void>();

interface Engine {
  ctx: AudioContext;
  master: GainNode;
  sfxBus: GainNode;
  musicFilter: BiquadFilterNode;
  musicDuck: GainNode;
}
let engine: Engine | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

interface MusicTrack { name: MusicName; source: AudioBufferSourceNode; gain: GainNode }
let currentTrack: MusicTrack | null = null;
let desiredMusic: { name: MusicName; volume: number } | null = null;

const MASTER_VOLUME = 0.9;
const MUSIC_FADE_S = 0.6;

const getEngine = (): Engine | null => {
  if (!isBrowser()) return null;
  if (engine) return engine;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = isMuted ? 0 : MASTER_VOLUME;
  master.connect(ctx.destination);

  const sfxBus = ctx.createGain();
  sfxBus.connect(master);

  const musicDuck = ctx.createGain();
  musicDuck.connect(master);
  const musicFilter = ctx.createBiquadFilter();
  musicFilter.type = 'lowpass';
  musicFilter.frequency.value = 20000;
  musicFilter.connect(musicDuck);

  engine = { ctx, master, sfxBus, musicFilter, musicDuck };
  return engine;
};

// Los navegadores bloquean el audio hasta el primer gesto: lo desbloqueamos ahí
const unlock = () => {
  const e = getEngine();
  if (e && e.ctx.state === 'suspended') e.ctx.resume().catch(() => {});
  if (desiredMusic && !currentTrack) playMusic(desiredMusic.name, desiredMusic.volume);
};
if (isBrowser()) {
  ['pointerdown', 'keydown', 'touchend'].forEach(ev => window.addEventListener(ev, unlock, { passive: true }));
}

const loadBuffer = (file: string): Promise<AudioBuffer | null> => {
  let p = buffers.get(file);
  if (!p) {
    const e = getEngine();
    p = !e
      ? Promise.resolve(null)
      : fetch(`/sounds/${file}`)
          .then(r => r.arrayBuffer())
          .then(data => e.ctx.decodeAudioData(data))
          .catch(err => { console.warn('Audio not loaded:', file, err); return null; });
    buffers.set(file, p);
  }
  return p;
};

/** Precarga los mp3 para que el primer sonido no tenga retardo. */
export const preloadSounds = () => {
  if (!isBrowser()) return;
  [...Object.values(SFX_FILES), ...Object.values(MUSIC_FILES)].forEach(loadBuffer);
};

// --- SILENCIO ---
export const subscribeMute = (listener: () => void) => {
  muteListeners.add(listener);
  return () => { muteListeners.delete(listener); };
};

export const getMuteState = (): boolean => isMuted;

export const toggleMute = (): boolean => {
  isMuted = !isMuted;
  const e = getEngine();
  if (e) e.master.gain.setTargetAtTime(isMuted ? 0 : MASTER_VOLUME, e.ctx.currentTime, 0.05);
  if (!isMuted && desiredMusic && !currentTrack) playMusic(desiredMusic.name, desiredMusic.volume);
  muteListeners.forEach(l => l());
  return isMuted;
};

// --- EFECTOS ---
/** Variación aleatoria de tono para que un sonido repetido no canse */
const jitter = (amount: number) => 1 + (Math.random() * 2 - 1) * amount;

/** Efectos en mp3 (los que dispara la lógica de juego) */
export const playSound = (name: SoundName, volume = 0.5) => {
  const e = getEngine();
  if (!e || isMuted) return;
  loadBuffer(SFX_FILES[name]).then(buffer => {
    if (!buffer) return;
    const src = e.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = name === 'click' ? jitter(0.06) : 1;
    const gain = e.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(e.sfxBus);
    src.start();
  });
};

/** Efectos sintetizados de "game feel" (vuelo de carta, golpes, latidos...) */
export const playSfx = (name: SynthName, volume = 1, pitch = 1) => {
  const e = getEngine();
  if (!e || isMuted || e.ctx.state !== 'running') return;
  SYNTHS[name](e.ctx, e.sfxBus, volume, pitch * jitter(0.04));
};

/** Baja la música un momento para que destaque un golpe */
export const duckMusic = (amount = 0.4, seconds = 0.35) => {
  const e = getEngine();
  if (!e) return;
  const t = e.ctx.currentTime;
  e.musicDuck.gain.cancelScheduledValues(t);
  e.musicDuck.gain.setValueAtTime(e.musicDuck.gain.value, t);
  e.musicDuck.gain.linearRampToValueAtTime(1 - amount, t + 0.03);
  e.musicDuck.gain.linearRampToValueAtTime(1, t + seconds);
};

/** Música "a través de la pared" (modales abiertos) */
export const setMusicMuffled = (muffled: boolean) => {
  const e = getEngine();
  if (!e) return;
  e.musicFilter.frequency.setTargetAtTime(muffled ? 700 : 20000, e.ctx.currentTime, 0.12);
};

/** Vibración corta en móviles compatibles */
export const vibrate = (pattern: number | number[]) => {
  if (!isBrowser() || isMuted) return;
  try { navigator.vibrate?.(pattern); } catch { /* sin soporte */ }
};

// --- MÚSICA (bucles con fundido cruzado) ---
const fadeOutTrack = (track: MusicTrack, seconds = MUSIC_FADE_S) => {
  const e = getEngine();
  if (!e) return;
  const t = e.ctx.currentTime;
  track.gain.gain.cancelScheduledValues(t);
  track.gain.gain.setValueAtTime(track.gain.gain.value, t);
  track.gain.gain.linearRampToValueAtTime(0, t + seconds);
  track.source.stop(t + seconds + 0.05);
};

export const playMusic = (name: MusicName, volume = 0.3) => {
  if (!isBrowser()) return;
  desiredMusic = { name, volume };
  if (currentTrack?.name === name) return;

  const e = getEngine();
  if (!e || e.ctx.state !== 'running') return; // arrancará al desbloquear el audio

  const previous = currentTrack;
  currentTrack = null;
  if (previous) fadeOutTrack(previous);

  loadBuffer(MUSIC_FILES[name]).then(buffer => {
    // Si mientras cargaba se pidió otra pista o silencio, no hacemos nada
    if (!buffer || desiredMusic?.name !== name || currentTrack) return;
    const source = e.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = e.ctx.createGain();
    const t = e.ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + MUSIC_FADE_S);
    source.connect(gain).connect(e.musicFilter);
    source.start();
    currentTrack = { name, source, gain };
  });
};

export const stopMusic = (fadeSeconds = 0.8) => {
  desiredMusic = null;
  if (currentTrack) fadeOutTrack(currentTrack, fadeSeconds);
  currentTrack = null;
};
