// --- SELLOS (logros) ---
// Cada sello se gana haciendo algo concreto. Las condiciones son funciones puras sobre
// lo que pasó en una pelea o en la partida, así se pueden probar sin interfaz.
import { CombatResult, GameResult, Rank } from '@/types';

export const STAMP_IDS = [
  'first_win', 'republicana', 'flawless', 'comeback', 'massacre', 'barrage',
  'lightning', 'hard_win', 'streak3', 'full_court', 'stalemate', 'veteran',
] as const;

export type StampId = typeof STAMP_IDS[number];

/** Lo que se va anotando durante una partida */
export interface MatchTrack {
  ranksPlayed: Rank[];
}

export const newMatchTrack = (): MatchTrack => ({ ranksPlayed: [] });

const FULL_COURT: Rank[] = ['J', 'Q', 'K', 'A', 'JOKER'];

/** Sellos que se ganan al resolverse una pelea */
export const roundStamps = (result: CombatResult): StampId[] => {
  const out: StampId[] = [];
  if (result.isRepublicanaTriggered) out.push('republicana');
  // Solo cuentan las cartas del rival que caen
  if (result.deadByOwner.opponent >= 3) out.push('massacre');
  if (result.opponentDamageTaken >= 3) out.push('barrage');
  return out;
};

export interface MatchEnd {
  result: GameResult;
  /** La partida era contra el último boss */
  finalBoss: boolean;
  rounds: number;
  livesLeft: number;
  startingLives: number;
  streak: number;
  totalGames: number;
  track: MatchTrack;
}

/** Sellos que se ganan al acabar la partida */
export const endStamps = (m: MatchEnd): StampId[] => {
  const out: StampId[] = [];
  if (m.result === 'win') {
    out.push('first_win');
    if (m.livesLeft === m.startingLives) out.push('flawless');
    if (m.livesLeft === 1) out.push('comeback');
    if (m.rounds <= 3) out.push('lightning');
    if (m.finalBoss) out.push('hard_win');
    if (m.streak >= 3) out.push('streak3');
  }
  if (m.result === 'draw') out.push('stalemate');
  if (FULL_COURT.every(r => m.track.ranksPlayed.includes(r))) out.push('full_court');
  if (m.totalGames >= 25) out.push('veteran');
  return out;
};
