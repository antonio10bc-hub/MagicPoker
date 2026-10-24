import { BoardSlot, Card, Difficulty, Rng, SealId } from '@/types';
import { applyPreCombatSeals, calculateCombat, getAvailableSlots, getSealTargets, isSealCard, lifeGains, playCardToSlot, RANKS } from '@/lib/game-utils';

const pickRandom = <T,>(items: T[], rng: Rng): T => items[Math.floor(rng() * items.length)];

export interface OpponentMove {
  cardId: string;
  slotIndex: number;
}

// --- SELLOS DEL RIVAL (bosses) ---
// Cada sello busca la carta propia donde rinde más. Devuelve null si no conviene.
const value = (s: BoardSlot) => s.card?.value ?? 0;
/** La carta tuya más fuerte que golpea a este hueco (la de enfrente o las vecinas) */
const threat = (s: BoardSlot, pb: BoardSlot[]) =>
  Math.max(0, ...[s.index - 1, s.index, s.index + 1].map(i => pb[i]?.card?.value ?? 0));
const SEAL_TARGET: Record<SealId, (targets: BoardSlot[], playerBoard: BoardSlot[]) => BoardSlot | null> = {
  // Defensa: la carta que más arriesga (tiene una tuya delante), y si no, la mejor
  shield: (t, pb) => [...t].sort((a, b) => Number(!!pb[b.index].card) - Number(!!pb[a.index].card) || value(b) - value(a))[0],
  // Ataque doble: la carta más fuerte que ataque
  double: t => [...t].filter(s => RANKS[s.card!.rank].attack).sort((a, b) => value(b) - value(a))[0] ?? null,
  // Cambio: cualquiera (la de menor valor, para recolocarla)
  shift: t => [...t].sort((a, b) => value(a) - value(b))[0],
  // Cambio con enemigo: robarte tu mejor carta, si hay alguna delante de las suyas
  swap: (t, pb) => [...t].filter(s => pb[s.index].card).sort((a, b) => value(pb[b.index]) - value(pb[a.index]))[0] ?? null,
  // Vida: la carta con más números de caer (la más débil)
  life: t => [...t].sort((a, b) => value(a) - value(b))[0],
  // Espejo: la que tiene delante la carta tuya más fuerte (le devolverá el golpe)
  mirror: (t, pb) => [...t].filter(s => threat(s, pb) > 0).sort((a, b) => threat(b, pb) - threat(a, pb))[0] ?? null,
  // Veneno: la que va a caer (tiene delante una tuya más fuerte), para llevársela
  poison: (t, pb) => [...t].filter(s => threat(s, pb) >= value(s)).sort((a, b) => value(a) - value(b))[0] ?? null,
  // Eco: la más débil, que dejará un 2 al caer
  echo: t => [...t].sort((a, b) => value(a) - value(b))[0],
  // Ancla: la mejor, para que no se la quiten
  anchor: t => [...t].sort((a, b) => value(b) - value(a))[0],
  // Revelar: solo si tienes alguna carta en la mesa (la expone)
  reveal: (t, pb) => (pb.some(s => s.card) ? [...t].sort((a, b) => value(pb[b.index]) - value(pb[a.index]))[0] : null),
};

const sealMove = (hand: Card[], opponentBoard: BoardSlot[], playerBoard: BoardSlot[]): OpponentMove | null => {
  const targets = getSealTargets(opponentBoard).map(i => opponentBoard[i]);
  if (targets.length === 0) return null;
  for (const card of hand.filter(isSealCard)) {
    const target = SEAL_TARGET[card.seal!](targets, playerBoard);
    if (target) return { cardId: card.id, slotIndex: target.index };
  }
  return null;
};

// --- EL AS (borra la mesa entera, la suya también) ---
// No debe ser ni un genio ni tonto: no se carga su propia mesa cuando va claramente por
// delante (p. ej. Rey con ataque doble y Reina contra poca cosa), pero sí lo usa cuando
// vais parejos o tú vas mejor, y en la zona dudosa a veces se arriesga.
/** Fuerza de una mesa: valor de sus cartas, y cada sello puesto cuenta como 4 más */
export const boardStrength = (board: BoardSlot[]) =>
  board.reduce((sum, s) => sum + (s.card ? s.card.value + (s.card.seal ? 4 : 0) : 0), 0);
/** Ventaja a partir de la cual se lo guarda siempre */
const ACE_CLEAR_LEAD = 6;
/** Ventaja pequeña en la que a veces se arriesga igualmente */
const ACE_SMALL_LEAD = 2;
const ACE_RISK_CHANCE = 0.25;

/** ¿Le compensa ahora borrar la mesa? */
export const aceWorthIt = (opponentBoard: BoardSlot[], playerBoard: BoardSlot[], rng: Rng = Math.random): boolean => {
  const lead = boardStrength(opponentBoard) - boardStrength(playerBoard);
  if (lead > ACE_CLEAR_LEAD) return false;
  if (lead > ACE_SMALL_LEAD) return rng() < ACE_RISK_CHANCE;
  return true;
};

// --- IA QUE PIENSA (normal y difícil) ---
// Antes de cada jugada prueba en su cabeza todas las cartas de su mano en todos los
// huecos: aplica los sellos de antes del choque y calcula la pelea con las mismas
// reglas del juego (el Príncipe, con un azar fijo). Puntúa lo que pasaría: daño que
// hace y que recibe, vidas que se curan, cartas que caen de cada lado y lo que queda en
// pie para las rondas siguientes; si con eso gana o pierde la partida, manda eso. Gastar
// una carta buena para nada resta un poco (se la guarda), y poner un sello suma un poco.
//  - normal: casi siempre una de sus mejores jugadas, pero no siempre la mejor.
//  - difícil (jefes, Castillo y Bosque desde difícil): la mejor; y se planta si ninguna
//    jugada mejora lo que ya hay, o si tú ya te has plantado y no gana nada jugando.
// "Fácil" sigue siendo el rival al azar de siempre.

export interface AiContext {
  /** Sus vidas y las tuyas (para ver si una pelea acaba la partida) */
  lives?: number;
  playerLives?: number;
  /** Te has plantado: ya no vas a poner más cartas esta ronda */
  playerPassed?: boolean;
}

/** El Príncipe golpea al azar: para pensar, un azar fijo */
const SIM_RNG: Rng = () => 0.5;

const sumValues = (cards: (Card | null | undefined)[]) => cards.reduce((n, c) => n + (c?.value ?? 0), 0);

/** Lo bien que le iría la pelea con estas mesas (mayor = mejor para el rival) */
export const evaluateFight = (playerBoard: BoardSlot[], opponentBoard: BoardSlot[], ctx: AiContext = {}): number => {
  const pre = applyPreCombatSeals(playerBoard, opponentBoard);
  const r = calculateCombat(pre.player, pre.opponent, SIM_RNG);
  const gone = new Set([...r.deadCardIds, ...r.voidedCardIds]);
  const lost = (board: BoardSlot[]) => sumValues(board.map(s => (s.card && gone.has(s.card.id) ? s.card : null)));
  const standing = (board: BoardSlot[]) => sumValues(board.map(s => (s.card && !gone.has(s.card.id) ? s.card : null)));
  const healed = lifeGains(pre.opponent, r);
  const theirHeal = lifeGains(pre.player, r);
  let score = 10 * (r.playerDamageTaken - r.opponentDamageTaken) + 10 * (healed - theirHeal)
    + 0.6 * (lost(pre.player) - lost(pre.opponent))
    + 0.25 * (standing(pre.opponent) - standing(pre.player));
  if (ctx.playerLives !== undefined && r.playerDamageTaken - theirHeal >= ctx.playerLives) score += 200;
  if (ctx.lives !== undefined && r.opponentDamageTaken - healed >= ctx.lives) score -= 200;
  return score;
};

interface Candidate { cardId: string; slotIndex: number; score: number }

/** Todas sus jugadas posibles, puntuadas, de la mejor a la peor */
export const rankMoves = (hand: Card[], opponentBoard: BoardSlot[], playerBoard: BoardSlot[], ctx: AiContext = {}): Candidate[] => {
  const state = { lives: 0, hand, deck: [], board: opponentBoard, isPassed: false };
  const out: Candidate[] = [];
  hand.forEach(card => {
    if (card.wild) return;
    opponentBoard.forEach((_, slotIndex) => {
      const next = playCardToSlot(state, card.id, slotIndex, false);
      if (!next) return;
      // Gastar una carta cuesta un poco (mejor guardar las buenas); un sello puesto suma
      const cost = isSealCard(card) ? -1 : 0.3 * card.value;
      out.push({ cardId: card.id, slotIndex, score: evaluateFight(playerBoard, next.board, ctx) - cost });
    });
  });
  return out.sort((a, b) => b.score - a.score);
};

/** Decide qué carta juega el rival y dónde. Devuelve null si debe plantarse. */
export const chooseOpponentMove = (
  hand: Card[],
  opponentBoard: BoardSlot[],
  playerBoard: BoardSlot[],
  difficulty: Difficulty,
  rng: Rng = Math.random,
  ctx: AiContext = {},
): OpponentMove | null => {
  if (difficulty === 'easy') return easyMove(hand, opponentBoard, playerBoard, rng);
  const moves = rankMoves(hand, opponentBoard, playerBoard, ctx);
  if (moves.length === 0) return null;
  if (difficulty === 'normal') {
    // Casi siempre de las mejores; a veces, cualquiera
    const r = rng();
    const pick = r < 0.55 ? moves[0] : r < 0.8 ? moves[Math.min(1, moves.length - 1)] : moves[Math.floor(rng() * moves.length)];
    return { cardId: pick.cardId, slotIndex: pick.slotIndex };
  }
  // Difícil: la mejor, salvo que plantarse sea mejor
  const best = moves[0];
  const now = evaluateFight(playerBoard, opponentBoard, ctx);
  if (best.score < now) return null;
  if (ctx.playerPassed && best.score < now + 1) return null;
  return { cardId: best.cardId, slotIndex: best.slotIndex };
};

/** El rival al azar de siempre ("fácil"): su sello si tiene dónde, luego su primera carta en un hueco cualquiera */
const easyMove = (hand: Card[], opponentBoard: BoardSlot[], playerBoard: BoardSlot[], rng: Rng): OpponentMove | null => {
  const seal = sealMove(hand, opponentBoard, playerBoard);
  if (seal) return seal;
  const normal = hand.filter(c => !isSealCard(c));
  const aceOk = !normal.some(c => RANKS[c.rank].wipesBoard) || aceWorthIt(opponentBoard, playerBoard, rng);
  const card = normal.find(c => aceOk || !RANKS[c.rank].wipesBoard);
  const available = getAvailableSlots(opponentBoard);
  if (!card || available.length === 0) return null;
  return { cardId: card.id, slotIndex: pickRandom(available, rng) };
};
