// --- SISTEMA DE SONIDO ---

// Mapa exacto de los archivos que tienes en la carpeta public/sounds/
const SOUNDS = {
  click: 'click.mp3',     // Botones e interacciones UI
  defeat: 'defeat.mp3',   // Perder la partida
  shuffle: 'shuffle.mp3', // Empezar partida / Barajar
  victory: 'victory.mp3', // Ganar la partida
};

export type SoundName = keyof typeof SOUNDS;

// Estado global de silencio (por defecto false = hay sonido)
let isMuted = false;

// Función para alternar el estado y devolver el nuevo valor
export const toggleMute = (): boolean => {
    isMuted = !isMuted;
    return isMuted;
};

// Función para obtener el estado actual (útil para inicializar la UI)
export const getMuteState = (): boolean => isMuted;

export const playSound = (name: SoundName, volume: number = 0.5) => {
  // Evitar ejecución en servidor (Next.js)
  if (typeof window === 'undefined') return;

  // Si está muteado, no reproducimos nada
  if (isMuted) return;

  try {
    const fileName = SOUNDS[name];
    const audio = new Audio(`/sounds/${fileName}`);
    audio.volume = volume;
    
    // Reproducir y capturar errores (por si el navegador bloquea el audio)
    audio.play().catch((err) => {
      console.warn('Audio blocked or not found:', err);
    });
  } catch (error) {
    console.error('Error playing sound:', error);
  }
};