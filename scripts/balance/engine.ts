// --- SIMULADOR DE PARTIDAS (sin interfaz) ---
// Juega partidas enteras con las reglas de verdad (lib/): las mismas funciones que usa
// la tienda (store/useGameStore), encadenadas igual pero sin temporizadores ni guardado.
//  · Moneda al empezar; abre la ronda siguiente quien tiene más vidas.
//  · Por turnos: cada uno pone una carta o se planta; plantado, ya no juega esa ronda.
//  · Tus cartas van ocultas para el rival (y las suyas para ti) hasta la pelea.
//  · Comodín de Joker, sellos antes del choque, revelar al ponerlo, vida, Fénix,
//    empate por bloqueo o por inactividad, fase 2 del Soberano en el Castillo.
// El jugador lo lleva un bot (ver personas.ts); el rival, la IA del juego.
import { BoardSlot, Card, Difficulty, GameResult, Owner, PlayerState, SealId } from '@/types';
import {
  applyPreCombatSeals, applyReveal, calculateCombat, clearDefeatedCards, countRankOnBoard, createPlayerState, drawCards, drawRound,
  getGameResult, hideFromRival, isIdleDraw, isQuietFight, isStalemate, lifeGains, markCombatResult, nextOpener, playCardToSlot,
  revealBoard, risenPhoenixes, unhideBoard,
} from '@/lib/game-utils';
import { chooseOpponentMove } from '@/lib/ai';
import { CARDS_DRAWN_PER_ROUND, JOKER_DRAW_BONUS, STARTING_HAND_SIZE, STARTING_LIVES } from '@/lib/constants';

/** Azar con semilla (reproducible): sustituye a Math.random en todo el proceso */
export const seedRandom = (seed: number) => {
  let s = seed >>> 0;
  Math.random = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Lo que ve quien decide: su mano y su mesa, la mesa rival (lo oculto, oculto) y las vidas */
export interface View {
  hand: Card[];
  mine: BoardSlot[];
  theirs: BoardSlot[];
  lives: number;
  theirLives: number;
  theirPassed: boolean;
  /** Cartas del rival que aún no ha visto (para imaginar lo oculto) */
  unseen: Card[];
}

export interface Move { cardId: string; slotIndex: number; wildSeal?: SealId }
export type Chooser = (v: View) => Move | null;

/** La IA del juego como rival (exactamente como la llama la tienda) */
export const rivalAi = (difficulty: Difficulty): Chooser => v =>
  chooseOpponentMove(v.hand, v.mine, v.theirs, difficulty, Math.random,
    { lives: v.lives, playerLives: v.theirLives, playerPassed: v.theirPassed, unseen: v.unseen });

export interface MatchSetup {
  player: PlayerState;
  opponent: PlayerState;
  bot: Chooser;
  /** El bot ve las cartas ocultas del rival (techo de habilidad) */
  botSeesAll?: boolean;
  rival: Chooser;
  /** Castillo contra el Soberano: se transforma una vez al bajar a la mitad */
  sovereignPhase2?: boolean;
  /** Tope de rondas (por seguridad; nunca debería alcanzarse) */
  maxRounds?: number;
  /** ¿Y si...? (no está en el juego): cada sello que roba el jugador se repone con otra carta */
  sealCantrip?: boolean;
  /** Lo mismo para el rival (la regla, para todos) */
  rivalCantrip?: boolean;
  /** ¿Y si...? Cartas de más que roba el jugador cada ronda */
  extraDraw?: number;
}

export interface MatchResult {
  result: GameResult;
  rounds: number;
  livesLeft: number;
  rivalLivesLeft: number;
  /** Quién abrió la primera ronda (la moneda) */
  opener: Owner;
  /** Cartas jugadas por el bot, por rango (y sellos por tipo) */
  played: Record<string, number>;
  /** Se acabó por el tope de rondas (no debería pasar) */
  capped?: boolean;
  phase2?: boolean;
}

/** Lo oculto del rival, como lo ve el bot: sus cartas boca abajo, ocultas */
const asSeenByBot = (board: BoardSlot[], seesAll: boolean): BoardSlot[] =>
  seesAll ? board.map(s => (s.card ? { ...s, card: { ...s.card, hidden: false, isFaceUp: true } } : s))
    : board.map(s => (s.card && !s.card.isFaceUp && !s.card.isExposed ? { ...s, card: { ...s.card, hidden: true } } : s));

/** El sello se repone: por cada sello que hay en la mano sin reponer, roba otra carta */
const cantrip = (s: PlayerState, before: number): PlayerState => {
  let out = s;
  for (let i = before; i < out.hand.length && out.deck.length; i++) {
    if (out.hand[i].rank === 'SEAL') out = drawCards(out, 1, true);
  }
  return out;
};

export const playMatch = (m: MatchSetup): MatchResult => {
  let P = m.sealCantrip ? cantrip(m.player, 0) : m.player;
  let O = m.rivalCantrip ? cantrip(m.opponent, 0) : m.opponent;
  const opener0: Owner = Math.random() < 0.5 ? 'player' : 'opponent';
  let opener = opener0;
  let idle = 0;
  let phase2Done = false;
  const played: Record<string, number> = {};
  const maxRounds = m.maxRounds ?? 80;

  for (let round = 1; round <= maxRounds; round++) {
    P = { ...P, isPassed: false };
    O = { ...O, isPassed: false };
    let turn: Owner = opener;
    for (let guard = 0; guard < 60 && !(P.isPassed && O.isPassed); guard++) {
      if (turn === 'player') {
        if (P.isPassed) { turn = 'opponent'; continue; }
        const move = m.bot({
          hand: P.hand, mine: P.board, theirs: asSeenByBot(O.board, !!m.botSeesAll), lives: P.lives, theirLives: O.lives,
          theirPassed: O.isPassed, unseen: m.botSeesAll ? [] : [...O.hand, ...O.deck],
        });
        const card = move && P.hand.find(c => c.id === move.cardId);
        const placed = move && playCardToSlot(P, move.cardId, move.slotIndex, true, move.wildSeal);
        if (!placed || !card) {
          P = { ...P, isPassed: true };
          idle++;
          turn = 'opponent';
          continue;
        }
        P = hideFromRival(placed, card, move.slotIndex);
        const key = card.rank === 'SEAL' ? `SEAL:${card.wild ? move.wildSeal : card.seal}` : card.rank;
        played[key] = (played[key] ?? 0) + 1;
        const seal = card.rank === 'SEAL' ? (card.wild ? move.wildSeal : card.seal) : undefined;
        if (seal === 'reveal') { const r = applyReveal(O.board, move.slotIndex); if (r) O = { ...O, board: r.board }; }
        idle = 0;
        turn = O.isPassed ? 'player' : 'opponent';
      } else {
        if (O.isPassed) { turn = 'player'; continue; }
        const move = m.rival({
          hand: O.hand, mine: O.board, theirs: P.board, lives: O.lives, theirLives: P.lives, theirPassed: P.isPassed,
          unseen: [...P.hand, ...P.deck],
        });
        const card = move && O.hand.find(c => c.id === move.cardId);
        const next = move && playCardToSlot(O, move.cardId, move.slotIndex, false);
        if (!next || !card) {
          O = { ...O, isPassed: true };
          idle++;
          turn = 'player';
          continue;
        }
        O = next;
        if (card.rank === 'SEAL' && card.seal === 'reveal') { const r = applyReveal(P.board, move.slotIndex); if (r) P = { ...P, board: r.board }; }
        idle = 0;
        turn = P.isPassed ? 'opponent' : 'player';
      }
    }

    // --- La pelea ---
    O = { ...O, board: revealBoard(O.board) };
    P = { ...P, board: unhideBoard(P.board) };
    P = drawCards(P, countRankOnBoard(P.board, 'JOKER') * JOKER_DRAW_BONUS, true);
    O = drawCards(O, countRankOnBoard(O.board, 'JOKER') * JOKER_DRAW_BONUS, false);
    const pre = applyPreCombatSeals(P.board, O.board);
    P = { ...P, board: pre.player };
    O = { ...O, board: pre.opponent };
    const result = calculateCombat(P.board, O.board);
    P = { ...P, board: markCombatResult(P.board, result) };
    O = { ...O, board: markCombatResult(O.board, result) };

    const heal = (s: PlayerState, damage: number) => Math.max(0, Math.min(s.maxLives ?? STARTING_LIVES, s.lives - damage + lifeGains(s.board, result)));
    let nP: PlayerState = { ...P, lives: heal(P, result.playerDamageTaken), board: clearDefeatedCards(P.board), hand: [...P.hand, ...risenPhoenixes(P.board)], isPassed: false };
    const nO: PlayerState = { ...O, lives: heal(O, result.opponentDamageTaken), board: clearDefeatedCards(O.board), hand: [...O.hand, ...risenPhoenixes(O.board)], isPassed: false };

    if (m.sovereignPhase2 && !phase2Done) {
      const max = nO.maxLives ?? O.lives;
      if (nO.lives <= Math.floor(max / 2)) { nO.lives = max; phase2Done = true; }
    }

    const end = getGameResult(nP, nO) ?? (isStalemate(P, O, result) || isIdleDraw(idle, P, O, result) ? 'draw' : null);
    if (end) {
      return { result: end, rounds: round, livesLeft: nP.lives, rivalLivesLeft: nO.lives, opener: opener0, played, phase2: phase2Done };
    }
    idle = isQuietFight(P, O, result) ? idle : 0;
    opener = nextOpener(nP, nO, opener);
    const before = nP.hand.length;
    nP = drawRound(nP, CARDS_DRAWN_PER_ROUND, true);
    if (m.extraDraw) nP = drawCards(nP, m.extraDraw, true);
    if (m.sealCantrip) nP = cantrip(nP, before);
    P = nP;
    const beforeO = nO.hand.length;
    O = drawRound(nO, CARDS_DRAWN_PER_ROUND, false);
    if (m.rivalCantrip) O = cantrip(O, beforeO);
  }
  return { result: 'draw', rounds: maxRounds, livesLeft: P.lives, rivalLivesLeft: O.lives, opener: opener0, played, capped: true, phase2: phase2Done };
};

/** Estado inicial del jugador: su mazo, 3 cartas en mano y sus vidas */
export const playerStart = (deck: Card[], lives = STARTING_LIVES, maxLives = lives): PlayerState =>
  ({ ...createPlayerState(deck, STARTING_HAND_SIZE, true, lives), maxLives });
