// --- MOTOR DE AUDIO (Web Audio) ---
// Grafo:  sfx ─────────────────────────────┐
//         música → filtro → nivel ─→ duck ─→ master → altavoces
// - Los mp3 de efectos se decodifican una vez a buffers y se reproducen sin latencia.
// - Los efectos de juego se sintetizan (lib/synth.ts) y la música es generativa
//   (lib/music.ts): no hay pistas en archivo.
// - La música se funde entre estilos, se "ahoga" con un paso bajo cuando hay un
//   modal abierto y baja de volumen un instante en los golpes fuertes (ducking).
// - Los volúmenes de música y efectos y la vibración salen de los ajustes.

import { SYNTHS, SynthName } from './synth';
import { MusicHandle, MusicVariant, startMusic } from './music';
import { getSettings, subscribeSettings } from './settings';

// Único efecto en archivo: barajar (encaja con la estética). El resto de nombres de
// playSound se sintetizan con la misma paleta que la música.
const SFX_FILES = { shuffle: 'shuffle.mp3' } as const;
const SOUND_SYNTHS = { click: 'tick', defeat: 'defeat', victory: 'victory', as_reveal: 'reveal' } as const;

const MUSIC_STYLES = { menu_music: 'menu', game_music: 'game' } as const;

export type SoundName = keyof typeof SFX_FILES | keyof typeof SOUND_SYNTHS;
export type MusicName = keyof typeof MUSIC_STYLES;
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
  musicLevel: GainNode;
  musicDuck: GainNode;
}
let engine: Engine | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

type TrackVariant = MusicVariant & { key: string };
interface MusicTrack { name: MusicName; key?: string; handle: MusicHandle }
let currentTrack: MusicTrack | null = null;
let desiredMusic: { name: MusicName; volume: number; variant?: TrackVariant } | null = null;

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
  sfxBus.gain.value = getSettings().sfx;
  sfxBus.connect(master);

  const musicDuck = ctx.createGain();
  musicDuck.connect(master);
  const musicLevel = ctx.createGain();
  musicLevel.gain.value = getSettings().music;
  musicLevel.connect(musicDuck);
  const musicFilter = ctx.createBiquadFilter();
  musicFilter.type = 'lowpass';
  musicFilter.frequency.value = 20000;
  musicFilter.connect(musicLevel);

  engine = { ctx, master, sfxBus, musicFilter, musicLevel, musicDuck };
  return engine;
};

// Los navegadores bloquean el audio hasta el primer gesto: lo desbloqueamos ahí
const unlock = () => {
  const e = getEngine();
  if (e && e.ctx.state === 'suspended') e.ctx.resume().catch(() => {});
  if (desiredMusic && !currentTrack) playMusic(desiredMusic.name, desiredMusic.volume, desiredMusic.variant);
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
  Object.values(SFX_FILES).forEach(loadBuffer);
};

// Los ajustes de volumen se aplican al momento
if (isBrowser()) {
  subscribeSettings(() => {
    if (!engine) return;
    const { music, sfx } = getSettings();
    const t = engine.ctx.currentTime;
    engine.musicLevel.gain.setTargetAtTime(music, t, 0.05);
    engine.sfxBus.gain.setTargetAtTime(sfx, t, 0.05);
  });
}

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
  if (!isMuted && desiredMusic && !currentTrack) playMusic(desiredMusic.name, desiredMusic.volume, desiredMusic.variant);
  muteListeners.forEach(l => l());
  return isMuted;
};

// --- EFECTOS ---
/** Variación aleatoria de tono para que un sonido repetido no canse */
const jitter = (amount: number) => 1 + (Math.random() * 2 - 1) * amount;

/** Efectos en mp3 (los que dispara la lógica de juego) */
export const playSound = (name: SoundName, volume = 0.5) => {
  if (name !== 'shuffle') { playSfx(SOUND_SYNTHS[name], volume * 2); return; }
  const e = getEngine();
  if (!e || isMuted) return;
  loadBuffer(SFX_FILES[name]).then(buffer => {
    if (!buffer) return;
    const src = e.ctx.createBufferSource();
    src.buffer = buffer;
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

/** Vibración en móviles compatibles (respeta el ajuste y el silencio) */
export const vibrate = (pattern: number | number[]) => {
  if (!isBrowser() || isMuted || !getSettings().vibration) return;
  try { navigator.vibrate?.(pattern); } catch { /* sin soporte */ }
};

/**
 * Vibraciones con significado: cada momento tiene su "textura" para que se distinga
 * sin mirar (un toque seco, un golpe doble, un redoble...).
 */
export const HAPTICS = {
  tick: 6,
  select: 8,
  place: 14,
  clashWin: [12, 30, 22],
  clashLose: [45, 25, 70],
  hitRival: [10, 20, 10, 20, 30],
  lifeLost: [70, 40, 110],
  wipe: [25, 35, 25, 35, 160],
  danger: [15, 90, 15],
  win: [30, 60, 30, 60, 40, 60, 180],
  loss: [260, 80, 120],
  stamp: [20, 40, 60],
} satisfies Record<string, number | number[]>;

export const haptic = (name: keyof typeof HAPTICS) => vibrate(HAPTICS[name]);

// --- MÚSICA (generativa, con fundido cruzado entre estilos) ---
let musicHeat = 0;

/** `variant` (con su `key`) cambia el tema: cada jefe suena a lo suyo */
export const playMusic = (name: MusicName, volume = 0.3, variant?: TrackVariant) => {
  if (!isBrowser()) return;
  desiredMusic = { name, volume, variant };
  if (currentTrack?.name === name && currentTrack.key === variant?.key) return;

  const e = getEngine();
  if (!e || e.ctx.state !== 'running') return; // arrancará al desbloquear el audio

  currentTrack?.handle.stop(MUSIC_FADE_S * 2);
  const handle = startMusic(e.ctx, e.musicFilter, MUSIC_STYLES[name], volume, variant);
  handle.setHeat(musicHeat);
  currentTrack = { name, key: variant?.key, handle };
};

export const stopMusic = (fadeSeconds = 0.8) => {
  desiredMusic = null;
  currentTrack?.handle.stop(fadeSeconds);
  currentTrack = null;
};

/** Tensión de la música: 0 calma, 1 pelea */
export const setMusicHeat = (heat: number) => {
  musicHeat = heat;
  currentTrack?.handle.setHeat(heat);
};
