// --- SISTEMA DE SONIDO ---

const SOUNDS = {
  click: 'click.mp3',
  defeat: 'defeat.mp3',
  shuffle: 'shuffle.mp3',
  victory: 'badassvictory.mp3', // CAMBIO: Usar badassvictory
  as_reveal: 'mild-surprise.mp3', // CAMBIO: Nuevo sonido para AS
  
  // Música de fondo (Loops)
  menu_music: 'menuloop.mp3',
  game_music: 'loopsong.mp3',
};

export type SoundName = keyof typeof SOUNDS;

// Estado global de silencio
let isMuted = false;

// Referencia global para la música actual (para poder pararla al cambiar de pantalla)
let currentMusic: HTMLAudioElement | null = null;
let currentMusicName: string | null = null;

export const toggleMute = (): boolean => {
    isMuted = !isMuted;
    // Si muteamos, paramos la música actual inmediatamente
    if (isMuted && currentMusic) {
        currentMusic.pause();
    } else if (!isMuted && currentMusic) {
        // Si desmuteamos, intentamos reanudar
        currentMusic.play().catch(() => {});
    }
    return isMuted;
};

export const getMuteState = (): boolean => isMuted;

// Función para reproducir efectos de sonido (SFX) puntuales
export const playSound = (name: SoundName, volume: number = 0.5) => {
  if (typeof window === 'undefined' || isMuted) return;

  // Ignoramos si es música, esto se maneja con playMusic
  if (name === 'menu_music' || name === 'game_music') return;

  try {
    const fileName = SOUNDS[name];
    const audio = new Audio(`/sounds/${fileName}`);
    audio.volume = volume;
    audio.play().catch((err) => {
      console.warn('Audio blocked or not found:', err);
    });
  } catch (error) {
    console.error('Error playing sound:', error);
  }
};

// Función específica para manejar música de fondo en bucle
export const playMusic = (name: 'menu_music' | 'game_music', volume: number = 0.3) => {
    if (typeof window === 'undefined') return;

    // Si ya está sonando esa misma canción, no hacemos nada
    if (currentMusicName === name && currentMusic && !currentMusic.paused) return;

    // Parar música anterior si existe
    stopMusic();

    if (isMuted) {
        // Si está muteado, solo guardamos qué debería sonar para cuando se desmutee
        currentMusicName = name;
        return;
    }

    try {
        const fileName = SOUNDS[name];
        const audio = new Audio(`/sounds/${fileName}`);
        audio.loop = true; // Importante: Bucle infinito
        audio.volume = volume;
        
        audio.play().catch((err) => {
             console.warn('Music autoplay blocked:', err);
        });

        currentMusic = audio;
        currentMusicName = name;
    } catch (error) {
        console.error('Error playing music:', error);
    }
};

export const stopMusic = () => {
    if (currentMusic) {
        currentMusic.pause();
        currentMusic.currentTime = 0;
        currentMusic = null;
        currentMusicName = null;
    }
};