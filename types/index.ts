export type Owner = 'player' | 'opponent';
export type Suit = 'standard' | 'joker' | 'seal';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | 'JOKER' | 'SEAL';

/**
 * Sellos: se aplican sobre una carta propia de la mesa.
 *  shield · aguanta todos los golpes de una pelea y se rompe
 *  double · la carta ataca dos veces
 *  shift  · al empezar cada pelea se cambia con el hueco de su derecha
 *  swap   · al empezar la pelea se cambia de bando con la carta de enfrente y se rompe
 *  life   · al morir la carta, su dueño recupera una vida
 *  mirror · devuelve el primer golpe que la mataría (muere el atacante) y se rompe
 *  poison · si muere en un choque, la carta que la ha matado también muere
 *  echo   · al morir en un choque deja un 2 en su hueco
 *  anchor · no la pueden mover ni robar (CAMBIO y ¡ROBO! no le afectan)
 *  reveal · al ponerla, la carta rival de enfrente se da la vuelta y queda expuesta
 *           (vale 1 menos en la próxima pelea)
 */
export type SealId = 'shield' | 'double' | 'shift' | 'swap' | 'life' | 'mirror' | 'poison' | 'echo' | 'anchor' | 'reveal';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Screen = 'menu' | 'game';
export type GameResult = 'win' | 'loss' | 'draw';
export type GamePhase = 'start' | 'placement' | 'combat' | 'combat-reveal' | 'end';

export interface DamageSource {
  rank: Rank;
  owner: Owner;
}

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
  value: number;
  isFaceUp: boolean;
  owner: Owner;
  isTakingDamage?: boolean;
  isVoided?: boolean;
  damageSource?: DamageSource;
  /** Carta de sello: qué sello es. Carta de la mesa: sello que lleva puesto */
  seal?: SealId;
  /** Su sello de defensa le ha salvado en esta pelea */
  isShielded?: boolean;
  /** Su sello de espejo ha devuelto un golpe en esta pelea (luego se rompe) */
  isReflecting?: boolean;
  /** Expuesta por un sello de revelar: vale 1 menos en la próxima pelea */
  isExposed?: boolean;
}

export interface BoardSlot {
  index: number;
  card: Card | null;
}

export interface PlayerState {
  lives: number;
  hand: Card[];
  board: BoardSlot[];
  deck: Card[];
  isPassed: boolean;
  /** Vidas máximas (el sello de vida no puede superarlas). Por defecto STARTING_LIVES */
  maxLives?: number;
}

export interface CombatResult {
  playerDamageTaken: number;
  opponentDamageTaken: number;
  deadCardIds: string[];
  voidedCardIds: string[];
  /** Daño directo recibido por cada hueco vacío (índice → daño) */
  playerEmptySlotsHit: Record<number, number>;
  opponentEmptySlotsHit: Record<number, number>;
  damageSources: Record<string, DamageSource>;
  /** Cartas destruidas en choque (las anuladas por el As no cuentan) */
  cardsDestroyedCount: number;
  /** Cartas destruidas de cada bando */
  deadByOwner: Record<Owner, number>;
  /** Cartas que su sello de defensa ha salvado (el sello se rompe) */
  shieldedIds: string[];
  /** Golpes que ha parado cada carta con defensa */
  shieldHits: Record<string, number>;
  /** Golpes devueltos por un espejo: la carta con el espejo y el atacante que muere */
  reflected: { mirrorId: string; attackerId: string }[];
  /** Cartas que mueren envenenadas (por matar a una carta con veneno) */
  poisonedIds: string[];
  /** Logro "La Republicana": el jugador usa un As contra J, Q y K rivales */
  isRepublicanaTriggered: boolean;
}

/** Generador de números aleatorios en [0, 1). Inyectable para tests. */
export type Rng = () => number;
