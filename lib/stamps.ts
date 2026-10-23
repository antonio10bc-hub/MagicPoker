// --- SELLOS (logros) ---
// Cada sello se gana haciendo algo concreto. Las condiciones son funciones puras sobre
// lo que pasó en una pelea o en la partida, así se pueden probar sin interfaz.
import { Card, CombatResult, GameResult, Rank } from '@/types';

export const STAMP_IDS = [
  'first_win', 'republicana', 'immolation', 'flawless', 'comeback', 'massacre', 'barrage',
  'lightning', 'hard_win', 'streak3', 'full_court', 'stalemate', 'veteran',
  // Ligados a los sellos
  'bulwark', 'heist', 'purist', 'reflex', 'venom', 'rematch', 'collector',
  // El Castillo
  'castle',
] as const;

export type StampId = typeof STAMP_IDS[number];

/** Lo que se va anotando durante una partida */
export interface MatchTrack {
  ranksPlayed: Rank[];
  /** Cartas de sello que has jugado */
  sealsPlayed: number;
}

export const newMatchTrack = (): MatchTrack => ({ ranksPlayed: [], sealsPlayed: 0 });

const COURT: Rank[] = ['J', 'Q', 'K'];

const FULL_COURT: Rank[] = ['J', 'Q', 'K', 'A', 'JOKER'];

/**
 * Logros que se ganan al resolverse una pelea. `mine` son tus cartas en la mesa al
 * empezar el choque (por id) y `cards`, todas las de la mesa.
 */
export const roundStamps = (result: CombatResult, mine: ReadonlySet<string> = new Set(), cards: ReadonlyMap<string, Card> = new Map()): StampId[] => {
  const out: StampId[] = [];
  if (result.isRepublicanaTriggered) out.push('republicana');
  // Inmolación: tu As se lleva tu propio J, Q y K
  const own = [...mine].flatMap(id => (cards.get(id) ? [cards.get(id)!.rank] : []));
  if (result.voidedCardIds.length > 0 && (['A', 'J', 'Q', 'K'] as Rank[]).every(r => own.includes(r))) out.push('immolation');
  // Solo cuentan las cartas del rival que caen
  if (result.deadByOwner.opponent >= 3) out.push('massacre');
  if (result.opponentDamageTaken >= 3) out.push('barrage');
  // Tu defensa para 3 golpes o más en una sola pelea
  if (Object.entries(result.shieldHits).some(([id, n]) => mine.has(id) && n >= 3)) out.push('bulwark');
  // Tu espejo devuelve un golpe
  if (result.reflected.some(r => mine.has(r.mirrorId))) out.push('reflex');
  // Tu veneno se lleva una figura rival
  if (result.poisonedIds.some(id => !mine.has(id) && COURT.includes(cards.get(id)?.rank as Rank))) out.push('venom');
  return out;
};

export interface MatchEnd {
  result: GameResult;
  /** La partida era contra el último boss */
  finalBoss: boolean;
  /** Revancha contra un boss ya vencido */
  rematch?: boolean;
  /** Cartas de sello que llevabas en el mazo */
  sealsInDeck?: number;
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
    if (m.rematch) out.push('rematch');
    // Ganar con sellos en el mazo sin jugar ninguno
    if ((m.sealsInDeck ?? 0) > 0 && m.track.sealsPlayed === 0) out.push('purist');
    if (m.streak >= 3) out.push('streak3');
  }
  if (m.result === 'draw') out.push('stalemate');
  if (FULL_COURT.every(r => m.track.ranksPlayed.includes(r))) out.push('full_court');
  if (m.totalGames >= 25) out.push('veteran');
  return out;
};
