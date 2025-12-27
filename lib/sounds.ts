// --- SISTEMA DE SONIDO ---

// Mapa exacto de los archivos que tienes en la carpeta public/sounds/
const SOUNDS = {
    click: 'click.mp3',     // Botones e interacciones UI
    defeat: 'defeat.mp3',   // Perder la partida
    shuffle: 'shuffle.mp3', // Empezar partida / Barajar
    victory: 'victory.mp3', // Ganar la partida
  };
  
  export type SoundName = keyof typeof SOUNDS;
  
  export const playSound = (name: SoundName, volume: number = 0.5) => {
    // Evitar ejecución en servidor (Next.js)
    if (typeof window === 'undefined') return;
  
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