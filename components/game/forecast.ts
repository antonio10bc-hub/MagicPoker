import { BoardSlot, Card, Owner, Rank, SealId } from '@/types';
import { combatValue, getTargetIndices, RANKS } from '@/lib/game-utils';

// --- PRONÓSTICOS CON INFORMACIÓN VISIBLE ---
// Ayudas de lectura para el jugador. Usan las mismas reglas que lib/game-utils (solo
// lectura) y nunca miran las cartas boca abajo del rival: una carta oculta se trata
// como "podría golpear el hueco de delante".

/**
 * Huecos tuyos en peligro. Una carta rival destapada amenaza exactamente los huecos de
 * su patrón: la Reina, solo en diagonal; el As y el Joker, ninguno. Boca abajo no se
 * sabe qué es, así que solo se avisa del hueco que tiene justo delante.
 */
export const threatsFrom = (opponentBoard: BoardSlot[]): boolean[] => {
  const threats = opponentBoard.map(() => false);
  opponentBoard.forEach(s => {
    if (!s.card) return;
    if (!s.card.isFaceUp) threats[s.index] = true;
    else getTargetIndices(s.index, s.card.rank).forEach(i => { threats[i] = true; });
  });
  return threats;
};

export interface Forecast {
  /** Golpes que seguro llegan a un hueco vacío (cada uno quita una vida) */
  sure: number;
  /** Golpes que pueden llegar (Príncipe al azar, cartas ocultas) */
  maybe: number;
}

/** Golpes de `attackers` contra los huecos vacíos de `defenders` */
const hitsOnEmpty = (attackers: BoardSlot[], defenders: BoardSlot[]): Forecast => {
  const out: Forecast = { sure: 0, maybe: 0 };
  // Un As en mesa anula todas las cartas: nadie golpea
  if (attackers.concat(defenders).some(s => s.card?.isFaceUp && RANKS[s.card.rank].wipesBoard)) return out;
  attackers.forEach(s => {
    if (!s.card) return;
    if (!s.card.isFaceUp) {
      if (!defenders[s.index].card) out.maybe++;
      return;
    }
    const attack = RANKS[s.card.rank].attack;
    if (!attack) return;
    const empty = getTargetIndices(s.index, s.card.rank).filter(i => !defenders[i].card);
    const times = s.card.seal === 'double' ? 2 : 1;
    if (attack.mode === 'random-one') out.maybe += empty.length > 0 ? times : 0;
    else out.sure += empty.length * times;
  });
  return out;
};

/** Lo que pasaría si la pelea empezase ahora: tu daño al rival y tu exposición */
export const forecastFight = (playerBoard: BoardSlot[], opponentBoard: BoardSlot[]) => ({
  dealt: hitsOnEmpty(playerBoard, opponentBoard),
  taken: hitsOnEmpty(opponentBoard, playerBoard),
});

/** Cartas que quedan en un mazo, agrupadas por rango (sin revelar el orden) */
export const deckSummary = (deck: Card[]): { rank: Rank; count: number }[] => {
  const order: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', 'JOKER'];
  const counts = new Map<Rank, number>();
  deck.forEach(c => counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1));
  return order.map(rank => ({ rank, count: counts.get(rank) ?? 0 }));
};

/** Sellos que quedan en el mazo de sellos, agrupados por tipo (el comodín, sin tipo, al final) */
export const sealDeckSummary = (deck: Card[]): { seal: SealId | undefined; count: number }[] => {
  const counts = new Map<SealId | undefined, number>();
  deck.forEach(c => counts.set(c.seal, (counts.get(c.seal) ?? 0) + 1));
  return [...counts].map(([seal, count]) => ({ seal, count })).sort((a, b) => (a.seal ? 0 : 1) - (b.seal ? 0 : 1));
};

// --- FLECHAS DE ATAQUE (lógica, sin geometría) ---

/** Un ataque: una carta conocida contra un hueco del bando contrario */
export interface Attack { card: Card; index: number; owner: Owner; target: number; maybe: boolean; preview: boolean }

export interface Preview { card: Card; slotIndex: number }

/**
 * Ataques de todas las cartas conocidas: las tuyas, la que estás colocando (vista
 * previa) y las del rival destapadas. Los Ases se devuelven aparte (barren la mesa).
 */
export const collectAttacks = (playerBoard: BoardSlot[], opponentBoard: BoardSlot[], preview: Preview | null) => {
  const attackers: { card: Card; index: number; owner: Owner; preview: boolean }[] = [];
  playerBoard.forEach(s => s.card && attackers.push({ card: s.card, index: s.index, owner: 'player', preview: false }));
  if (preview) attackers.push({ card: preview.card, index: preview.slotIndex, owner: 'player', preview: true });
  opponentBoard.forEach(s => s.card?.isFaceUp && attackers.push({ card: s.card, index: s.index, owner: 'opponent', preview: false }));

  const attacks: Attack[] = [];
  const wipers: { index: number; owner: Owner }[] = [];
  attackers.forEach(({ card, index, owner, preview: isPreview }) => {
    const def = RANKS[card.rank];
    if (def.wipesBoard) { wipers.push({ index, owner }); return; }
    if (!def.attack) return;
    getTargetIndices(index, card.rank).forEach(target =>
      attacks.push({ card, index, owner, target, maybe: def.attack!.mode === 'random-one', preview: isPreview }));
  });
  return { attacks, wipers };
};

/**
 * Enfrentamientos de frente (A ataca el hueco de B y B el de A, sin azar): la flecha
 * del que pierde se dibuja diminuta y, si empatan, ambas se quedan a mitad de camino.
 */
export const facingOutcomes = (attacks: Attack[]) => {
  const losing = new Set<Attack>();
  const clashing = new Set<Attack>();
  attacks.forEach(a => {
    const rival = attacks.find(b => b.owner !== a.owner && b.index === a.target && b.target === a.index && !b.maybe && !a.maybe);
    if (!rival) return;
    if (combatValue(a.card) < combatValue(rival.card)) losing.add(a);
    else if (combatValue(a.card) === combatValue(rival.card)) clashing.add(a);
  });
  return { losing, clashing };
};

// --- DAÑO A HUECOS RIVALES VACÍOS ("-N" dorado) ---

export interface Aim { sure: number; maybe: number; wipe: boolean; previewOnly: boolean }

/** Objetivos de tus cartas con flechas encendidas (y la vista previa) en la fila rival */
export const aimAtOpponent = (board: BoardSlot[], preview: Preview | null, shown: ReadonlySet<string>): Aim[] => {
  const aims: Aim[] = [0, 1, 2, 3].map(() => ({ sure: 0, maybe: 0, wipe: false, previewOnly: true }));
  const attackers = board
    .filter(s => s.card && shown.has(s.card.id))
    .map(s => ({ card: s.card!, index: s.index, isPreview: false }));
  if (preview) attackers.push({ card: preview.card, index: preview.slotIndex, isPreview: true });

  attackers.forEach(({ card, index, isPreview }) => {
    const def = RANKS[card.rank];
    if (def.wipesBoard) {
      aims.forEach(a => { a.wipe = true; a.previewOnly &&= isPreview; });
      return;
    }
    if (!def.attack) return;
    const times = card.seal === 'double' ? 2 : 1;
    getTargetIndices(index, card.rank).forEach(t => {
      if (def.attack!.mode === 'random-one') aims[t].maybe += times;
      else aims[t].sure += times;
      aims[t].previewOnly &&= isPreview;
    });
  });
  return aims;
};
