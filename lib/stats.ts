// --- GESTIÓN DE ESTADÍSTICAS (Local Storage) ---

export interface GameStats {
    wins: {
      easy: number;
      normal: number;
      hard: number;
    };
    totalGames: number;
    cardsPlayed: number;
    cardsDestroyed: number;
    // Logros
    achievementRepublicana: boolean; // AS limpió J, Q y K a la vez
  }
  
  const INITIAL_STATS: GameStats = {
    wins: { easy: 0, normal: 0, hard: 0 },
    totalGames: 0,
    cardsPlayed: 0,
    cardsDestroyed: 0,
    achievementRepublicana: false,
  };
  
  const STORAGE_KEY = 'magic_poker_stats';
  
  // Obtener estadísticas (si no existen, devuelve las iniciales)
  export const getStats = (): GameStats => {
    if (typeof window === 'undefined') return INITIAL_STATS;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...INITIAL_STATS, ...JSON.parse(stored) } : INITIAL_STATS;
    } catch (e) {
      console.error("Error reading stats", e);
      return INITIAL_STATS;
    }
  };
  
  // Guardar estadísticas (fusiona con lo que haya)
  export const saveStats = (newStats: Partial<GameStats>) => {
    if (typeof window === 'undefined') return;
  
    try {
      const current = getStats();
      // Fusión profunda manual para el objeto 'wins'
      const updated: GameStats = {
          ...current,
          ...newStats,
          wins: {
              ...current.wins,
              ...(newStats.wins || {})
          }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Error saving stats", e);
    }
  };
  
  // Helper para incrementar un contador simple
  export const incrementStat = (key: keyof Omit<GameStats, 'wins' | 'achievementRepublicana'>, amount = 1) => {
      const current = getStats();
      saveStats({ [key]: current[key] + amount });
  };