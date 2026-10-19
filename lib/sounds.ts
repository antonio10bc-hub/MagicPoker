// --- SISTEMA DE SONIDO ---

const SFX = {
  click: 'click.mp3',
  defeat: 'defeat.mp3',
  shuffle: 'shuffle.mp3',
  victory: 'badassvictory.mp3',
  as_reveal: 'mild-surprise.mp3',
} as const;

// Música de fondo (Loops)
const MUSIC = {
  menu_music: 'menuloop.mp3',
  game_music: 'loopsong.mp3',
} as const;

export type SoundName = keyof typeof SFX;
export type MusicName = keyof typeof MUSIC;

const isBrowser = () => typeof window !== 'undefined';

// Estado global de silencio + suscriptores (para que la UI reaccione)
let isMuted = false;
const muteListeners = new Set<() => void>();

// Música que debería sonar (se recuerda aunque esté silenciado)
let desiredMusic: { name: MusicName; volume: number } | null = null;
let currentMusic: HTMLAudioElement | null = null;
let currentMusicName: MusicName | null = null;

// Cada efecto se descarga una vez; luego se clona para poder solaparse
const sfxCache = new Map<SoundName, HTMLAudioElement>();

const getSfx = (name: SoundName): HTMLAudioElement => {
  let audio = sfxCache.get(name);
  if (!audio) {
    audio = new Audio(`/sounds/${SFX[name]}`);
    audio.preload = 'auto';
    sfxCache.set(name, audio);
  }
  return audio;
};

/** Precarga los efectos para que el primer clic no tenga retardo. */
export const preloadSounds = () => {
  if (!isBrowser()) return;
  (Object.keys(SFX) as SoundName[]).forEach(getSfx);
};

export const subscribeMute = (listener: () => void) => {
  muteListeners.add(listener);
  return () => { muteListeners.delete(listener); };
};

export const getMuteState = (): boolean => isMuted;

export const toggleMute = (): boolean => {
  isMuted = !isMuted;
  if (isMuted) {
    currentMusic?.pause();
  } else if (desiredMusic) {
    // Al desmutear, retomamos (o arrancamos) la música que toca
    if (currentMusic && currentMusicName === desiredMusic.name) {
      currentMusic.play().catch(() => {});
    } else {
      playMusic(desiredMusic.name, desiredMusic.volume);
    }
  }
  muteListeners.forEach(l => l());
  return isMuted;
};

// Efectos de sonido (SFX) puntuales
export const playSound = (name: SoundName, volume = 0.5) => {
  if (!isBrowser() || isMuted) return;
  try {
    const audio = getSfx(name).cloneNode() as HTMLAudioElement;
    audio.volume = volume;
    audio.play().catch(err => console.warn('Audio blocked or not found:', err));
  } catch (error) {
    console.error('Error playing sound:', error);
  }
};

// Música de fondo en bucle
export const playMusic = (name: MusicName, volume = 0.3) => {
  if (!isBrowser()) return;
  desiredMusic = { name, volume };

  // Si ya está sonando esa misma canción, no hacemos nada
  if (currentMusicName === name && currentMusic && !currentMusic.paused) return;

  stopCurrentMusic();
  if (isMuted) return;

  try {
    const audio = new Audio(`/sounds/${MUSIC[name]}`);
    audio.loop = true;
    audio.volume = volume;
    audio.play().catch(err => console.warn('Music autoplay blocked:', err));
    currentMusic = audio;
    currentMusicName = name;
  } catch (error) {
    console.error('Error playing music:', error);
  }
};

const stopCurrentMusic = () => {
  if (!currentMusic) return;
  currentMusic.pause();
  currentMusic.currentTime = 0;
  currentMusic = null;
  currentMusicName = null;
};

export const stopMusic = () => {
  desiredMusic = null;
  stopCurrentMusic();
};
