import { Owner } from '@/types';

// --- REGLAS DE LA PARTIDA ---
export const BOARD_SIZE = 4;
export const STARTING_LIVES = 4;
export const STARTING_HAND_SIZE = 3;
export const CARDS_DRAWN_PER_ROUND = 2;
export const JOKER_DRAW_BONUS = 2;

// --- RITMO (ms) ---
export const TIMINGS = {
  opponentThink: 1000,     // Pausa antes de que el rival juegue
  opponentAfterPlay: 500,  // Pausa tras colocar carta el rival
  combatFlip: 300,         // Hasta que se revelan las cartas rivales
  combatResolve: 500,      // Hasta que se calcula el combate
  combatReveal: 300,       // Hasta que aparece el botón de continuar
} as const;

export const COMBAT_REVEAL_SECONDS = 5;

// --- COLORES ---
export const COLORS = {
  player: '#8e0dff',
  opponent: '#ff590d',
  opponentCardBack: '#171616',
  joker: '#FDE047',
  damage: '#FF2222',
  voided: '#000000',
} as const;

export const OWNER_COLORS: Record<Owner, string> = {
  player: COLORS.player,
  opponent: COLORS.opponent,
};

// --- LOCAL STORAGE ---
export const STORAGE_KEYS = {
  stats: 'magic_poker_stats',
  hasPlayedBefore: 'has_played_before',
} as const;
