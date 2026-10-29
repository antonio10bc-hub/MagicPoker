// --- EL CASTILLO (roguelike) ---
// Se abre al vencer al jefe secreto. Es una subida por todos los jefes, uno tras otro
// y evolucionados, con tu mazo del editor. Las vidas se arrastran de pelea en pelea.
// Entre jefe y jefe eliges 1 de 3 mejoras sacadas de una bolsa (curarte y una carta
// nueva casi siempre están). Si caes, la subida se acaba y se empieza de cero.
import { Card, Rank, Rng, SealId } from '@/types';
import { CASTLE_RANKS, LEGENDARY_RANKS, createCard, createSealCard, createWildSealCard, DECK_RANKS, RANKS, shuffle } from '@/lib/game-utils';
import { ALL_SEALS, BOSSES } from '@/lib/bosses';
import { defaultDeckConfig, getDeckConfig, sanitizeDeckConfig } from '@/lib/deck';
import { STARTING_LIVES } from '@/lib/constants';
import { track } from '@/lib/analytics';

/** Una carta del mazo de la subida (se crea de nuevo en cada pelea) */
export interface CardTemplate {
  rank: Rank;
  /** Sello: en una carta de sello, cuál es; en otra, el sello permanente que lleva */
  seal?: SealId;
  /** Mejora de valor */
  bonus?: number;
  /** Comodín de sello */
  wild?: boolean;
  /** Te la ha dado (o tocado) el mercader */
  merchant?: boolean;
}

/** Mejoras entre jefes */
export type Boon =
  | { kind: 'heal' }
  | { kind: 'card'; rank: Rank | 'WILD' }
  | { kind: 'seal'; seal: SealId; target: number }
  | { kind: 'upgrade'; target: number }
  | { kind: 'purge'; targets: number[] }
  | { kind: 'maxLife' }
  | { kind: 'pact' };

/** Rareza de una mejora: común, rara o legendaria (las cartas legendarias) */
export type Rarity = 'common' | 'rare' | 'legendary';
const RARE_CARDS: (Rank | 'WILD')[] = ['KNIGHT', 'PRIESTESS', 'WILD'];
export const boonRarity = (boon: Boon): Rarity => {
  if (boon.kind === 'card') return LEGENDARY_RANKS.includes(boon.rank as Rank) ? 'legendary' : RARE_CARDS.includes(boon.rank) ? 'rare' : 'common';
  return boon.kind === 'seal' || boon.kind === 'maxLife' || boon.kind === 'pact' ? 'rare' : 'common';
};
/** Desde este piso el mercader puede traer una legendaria */
export const LEGENDARY_FROM_STAGE = 6;
const LEGENDARY_CHANCE = 0.3;

export interface CastleRun {
  /** Jefe al que te enfrentas (índice en BOSSES) */
  stage: number;
  lives: number;
  maxLives: number;
  deck: CardTemplate[];
  /** Pacto: el próximo jefe empieza con una vida menos */
  pact?: boolean;
  /** Mejoras para elegir tras la última victoria */
  offer?: Boon[];
  /** Cofre por abrir (cada CHEST_EVERY pisos): su premio ya está decidido */
  chest?: Boon;
  /** Desafíos activos en esta subida */
  challenges?: ChallengeId[];
  /** Lo que va pasando en la subida (para el resumen final) */
  stats?: RunStats;
}

// --- ESTADÍSTICAS DE LA SUBIDA Y RESUMEN FINAL ---
export interface RunStats {
  startedAt: number;
  /** Peleas (rondas de choque) jugadas */
  rounds: number;
  /** Vidas quitadas a los jefes y perdidas por ti */
  damageDealt: number;
  livesLost: number;
  /** Cartas del rival tumbadas y tuyas caídas */
  cardsDestroyed: number;
  cardsLost: number;
  /** Más vidas quitadas en una sola pelea */
  bestHit: number;
  /** Mejoras elegidas por rareza (mercader y cofres) */
  boons: Record<Rarity, number>;
  chests: number;
}

/** Resumen de la última subida terminada (conquistada o caída) */
export interface RunSummary {
  outcome: 'conquered' | 'fallen';
  /** Pisos vencidos */
  floors: number;
  deck: CardTemplate[];
  lives: number;
  maxLives: number;
  challenges?: ChallengeId[];
  stats: RunStats;
  endedAt: number;
}

const newStats = (): RunStats => ({
  startedAt: Date.now(), rounds: 0, damageDealt: 0, livesLost: 0, cardsDestroyed: 0, cardsLost: 0, bestHit: 0,
  boons: { common: 0, rare: 0, legendary: 0 }, chests: 0,
});
/** Las subidas de antes de las estadísticas empiezan a contar desde cero */
const statsOf = (run: CastleRun): RunStats => run.stats ?? newStats();

/** Una pelea del Castillo: se suma a las estadísticas de la subida */
export const trackCastleFight = (f: { dealt: number; lost: number; destroyed: number; cardsLost: number }) => {
  const state = getCastle();
  if (!state.run) return;
  const s = statsOf(state.run);
  const stats: RunStats = {
    ...s, rounds: s.rounds + 1, damageDealt: s.damageDealt + f.dealt, livesLost: s.livesLost + f.lost,
    cardsDestroyed: s.cardsDestroyed + f.destroyed, cardsLost: s.cardsLost + f.cardsLost, bestHit: Math.max(s.bestHit, f.dealt),
  };
  save({ ...state, run: { ...state.run, stats } });
};

const countBoon = (run: CastleRun, boon: Boon, chest = false): RunStats => {
  const s = statsOf(run);
  const r = boonRarity(boon);
  return { ...s, boons: { ...s.boons, [r]: s.boons[r] + 1 }, chests: s.chests + (chest ? 1 : 0) };
};

const summarize = (run: CastleRun, outcome: RunSummary['outcome'], floors: number, lives: number): RunSummary => {
  const sum: RunSummary = { outcome, floors, deck: run.deck, lives, maxLives: run.maxLives, challenges: run.challenges, stats: statsOf(run), endedAt: Date.now() };
  // Analíticas: cómo acabó la subida
  const s = sum.stats;
  track('castle_run_ended', {
    outcome, floors, lives, max_lives: run.maxLives, deck_size: run.deck.length, challenges: run.challenges ?? [], challenges_count: run.challenges?.length ?? 0,
    rounds: s.rounds, minutes: Math.round((sum.endedAt - s.startedAt) / 60000), lives_taken: s.damageDealt, lives_lost: s.livesLost,
    boons_common: s.boons.common, boons_rare: s.boons.rare, boons_legendary: s.boons.legendary, chests: s.chests,
  });
  return sum;
};

// --- DESAFÍOS (se abren al conquistar el Castillo una vez) ---
//  noHeal  · nadie te ofrece curarte
//  fierce  · los jefes tienen una vida más
//  sealed  · los jefes llevan un nivel más (más sellos)
//  short   · empiezas sin tus 4 cartas más flojas
//  fragile · empiezas con 3 vidas (y 3 de tope)
//  noDeath · sin puntos de guardado: hay que conquistarlo de una tirada, sin caer
export type ChallengeId = 'noHeal' | 'fierce' | 'sealed' | 'short' | 'fragile' | 'noDeath';
export const CHALLENGES: ChallengeId[] = ['noHeal', 'fierce', 'sealed', 'short', 'fragile', 'noDeath'];
/** Desafíos a la vez para el dorso de la Corona (eran todos cuando había cinco) */
export const CROWN_CHALLENGES = 5;
const has = (run: CastleRun | undefined | null, c: ChallengeId) => !!run?.challenges?.includes(c);

export interface CastleState {
  run: CastleRun | null;
  /** Mejor subida (jefes vencidos) */
  best: number;
  /** Veces que lo has conquistado */
  conquered: number;
  /** Más desafíos a la vez con los que lo has conquistado */
  bestChallenges?: number;
  /** Los últimos desafíos elegidos (para no marcarlos otra vez) */
  lastChallenges?: ChallengeId[];
  /** Ya has conseguido alguna carta legendaria */
  legendary?: boolean;
  /** Resumen de la última subida terminada */
  lastSummary?: RunSummary;
  /** Punto de guardado: la subida tal como estaba al llegar a un piso de guardado. Si caes,
   *  puedes retomarla desde ahí (con las vidas llenas). Empezar de cero lo borra */
  checkpoint?: CastleRun;
}

// --- PUNTOS DE GUARDADO Y PISOS FÁCILES ---
// Al llegar a los pisos 4 y 8 (ya elegida la mejora) la subida queda guardada: si caes
// más arriba, vuelves a ese piso con el mazo de entonces y las vidas llenas. El desafío
// «Sin caer» los quita. Los jefes de los 6 primeros pisos piensan con la IA normal (salvo
// con «Jefes feroces»); del 7.º en adelante, con la difícil.
/** Pisos de guardado (índices: el 3 es el piso 4) */
export const CHECKPOINT_STAGES = [3, 7];
export const NORMAL_AI_FLOORS = 6;
export const isCheckpointFloor = (stage: number) => CHECKPOINT_STAGES.includes(stage);
/** Cómo piensa el jefe de este piso */
export const castleAi = (stage: number, run?: CastleRun | null): 'normal' | 'hard' =>
  stage < NORMAL_AI_FLOORS && !has(run, 'fierce') ? 'normal' : 'hard';
/** Si la subida queda lista en un piso de guardado (sin cofre ni mejora pendientes), se guarda */
const withCheckpoint = (state: CastleState, run: CastleRun): CastleState =>
  isCheckpointFloor(run.stage) && !run.offer && !run.chest && !has(run, 'noDeath') ? { ...state, checkpoint: { ...run } } : state;

// --- DORSOS DEL CASTILLO ---
//  castle   · conquistar el Castillo
//  merchant · conseguir una carta legendaria (del mercader o de un cofre)
//  crown    · conquistarlo con 5 desafíos a la vez
export const CASTLE_BACKS = ['castle', 'merchant', 'crown'] as const;
export type CastleBack = typeof CASTLE_BACKS[number];
export const castleBacks = (s: CastleState = getCastle()): CastleBack[] => CASTLE_BACKS.filter(b =>
  b === 'castle' ? s.conquered > 0 : b === 'merchant' ? !!s.legendary : (s.bestChallenges ?? 0) >= CROWN_CHALLENGES);

export const CASTLE_LENGTH = BOSSES.length;
const KEY = 'magic_poker_castle';
const EMPTY: CastleState = { run: null, best: 0, conquered: 0 };

// --- PERSISTENCIA ---
const listeners = new Set<() => void>();
let cached: CastleState | null = null;

export const getCastle = (): CastleState => {
  if (typeof window === 'undefined') return EMPTY;
  if (!cached) {
    try {
      const raw = localStorage.getItem(KEY);
      cached = raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<CastleState>) } : EMPTY;
      // Una subida rota o de otra versión se descarta
      if (cached.run && !isRun(cached.run)) cached = { ...cached, run: null };
      if (cached.checkpoint && !isRun(cached.checkpoint)) cached = { ...cached, checkpoint: undefined };
    } catch {
      cached = EMPTY;
    }
  }
  return cached;
};
export const getServerCastle = (): CastleState => EMPTY;
export const subscribeCastle = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

const save = (state: CastleState) => {
  cached = state;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* sin almacenamiento */ }
  listeners.forEach(l => l());
};

const isRun = (r: CastleRun) =>
  typeof r.stage === 'number' && r.stage >= 0 && r.stage < CASTLE_LENGTH && typeof r.lives === 'number' && Array.isArray(r.deck)
  && r.deck.every(c => c.rank in RANKS && (c.seal === undefined || ALL_SEALS.includes(c.seal)));

// --- SUBIDA ---

/** Tu mazo del editor como plantillas */
const startingDeck = (): CardTemplate[] => {
  const config = sanitizeDeckConfig(getDeckConfig() ?? defaultDeckConfig());
  const removed = new Set(config.removed);
  return [
    ...DECK_RANKS.filter(r => !removed.has(r)).map(rank => ({ rank })),
    ...(Object.entries(config.seals) as [SealId, number][]).flatMap(([seal, n]) => Array.from({ length: n }, () => ({ rank: 'SEAL' as Rank, seal }))),
  ];
};

/** Empieza una subida nueva (o devuelve la que está a medias), con sus desafíos */
export const ensureRun = (challenges: ChallengeId[] = []): CastleRun => {
  const state = getCastle();
  if (state.run) return state.run;
  const valid = CHALLENGES.filter(c => challenges.includes(c));
  const lives = valid.includes('fragile') ? STARTING_LIVES - 1 : STARTING_LIVES;
  let deck = startingDeck();
  if (valid.includes('short')) {
    // Fuera las 4 cartas normales más flojas
    const weakest = deck.map((c, i) => ({ c, i })).filter(({ c }) => c.rank !== 'SEAL')
      .sort((a, b) => RANKS[a.c.rank].value - RANKS[b.c.rank].value).slice(0, 4).map(w => w.i);
    deck = deck.filter((_, i) => !weakest.includes(i));
  }
  const run: CastleRun = { stage: 0, lives, maxLives: lives, deck, stats: newStats(), ...(valid.length ? { challenges: valid } : {}) };
  save({ ...state, run, lastChallenges: valid, checkpoint: undefined });
  track('castle_run_started', { challenges: valid, challenges_count: valid.length, deck_size: deck.length, attempt: state.conquered > 0 ? 'after_conquest' : 'normal' });
  return run;
};

export const abandonRun = () => save({ ...getCastle(), run: null });

/** Retoma la subida desde el punto de guardado (con las vidas llenas). Devuelve la subida */
export const resumeCheckpoint = (): CastleRun | null => {
  const state = getCastle();
  if (state.run) return state.run;
  if (!state.checkpoint) return null;
  const run: CastleRun = { ...state.checkpoint, lives: state.checkpoint.maxLives, offer: undefined, chest: undefined };
  save({ ...state, run });
  track('castle_checkpoint_resumed', { floor: run.stage + 1 });
  return run;
};

/** Jefe evolucionado: nivel de revancha según lo alto que estés */
export const castleBossLevel = (stage: number, run?: CastleRun | null) => Math.min(4, (stage < 4 ? 1 : stage < 8 ? 2 : 3) + (has(run, 'sealed') ? 1 : 0));
/** Vidas del jefe: menos que en sus partidas (aquí las tuyas se arrastran), crecen al subir */
export const castleBossLives = (run: CastleRun) => Math.max(1, 3 + Math.floor(run.stage / 3) - (run.pact ? 1 : 0) + (has(run, 'fierce') ? 1 : 0));

/** Mazo de la pelea a partir de las plantillas */
export const buildRunDeck = (run: CastleRun): Card[] => shuffle(run.deck.map(t => {
  const card = t.wild ? createWildSealCard('player')
    : t.rank === 'SEAL' ? createSealCard('player', t.seal!)
      : createCard('player', t.rank, { seal: t.seal, bonus: t.bonus });
  return t.merchant ? { ...card, merchant: true } : card;
}));

// --- MEJORAS ---

const pick = <T,>(items: T[], rng: Rng): T => items[Math.floor(rng() * items.length)];
/** Cartas normales del mazo (las que se pueden mejorar, sellar o quitar) */
const normalCards = (run: CastleRun) => run.deck.map((c, i) => ({ c, i })).filter(({ c }) => c.rank !== 'SEAL');

/** Una mejora concreta de cada tipo (o null si ahora no tiene sentido) */
const makeBoon = (kind: Boon['kind'], run: CastleRun, rng: Rng): Boon | null => {
  switch (kind) {
    case 'heal': return run.lives < run.maxLives && !has(run, 'noHeal') ? { kind } : null;
    case 'card': return { kind, rank: pick<Rank | 'WILD'>([...CASTLE_RANKS, 'WILD'], rng) };
    case 'seal': {
      const free = normalCards(run).filter(({ c }) => !c.seal);
      return free.length ? { kind, seal: pick(ALL_SEALS, rng), target: pick(free, rng).i } : null;
    }
    case 'upgrade': {
      const cards = normalCards(run).filter(({ c }) => RANKS[c.rank].attack);
      return cards.length ? { kind, target: pick(cards, rng).i } : null;
    }
    case 'purge': {
      const cards = normalCards(run);
      if (cards.length < 9) return null;
      // Las dos más flojas, para que salgan más a menudo las buenas
      const weakest = [...cards].sort((a, b) => RANKS[a.c.rank].value + (a.c.bonus ?? 0) - RANKS[b.c.rank].value - (b.c.bonus ?? 0)).slice(0, 2);
      return { kind, targets: weakest.map(w => w.i) };
    }
    case 'maxLife': return { kind };
    case 'pact': return run.lives >= 2 ? { kind } : null;
  }
};

/** Tres mejoras de la bolsa: curarte y una carta nueva casi siempre; el resto, al azar */
export const offerBoons = (run: CastleRun, rng: Rng = Math.random): Boon[] => {
  const out: Boon[] = [];
  const add = (kind: Boon['kind']) => {
    if (out.length >= 3 || out.some(b => b.kind === kind)) return;
    const boon = makeBoon(kind, run, rng);
    if (boon) out.push(boon);
  };
  if (rng() < 0.85) add('heal');
  if (rng() < 0.85) add('card');
  for (const kind of shuffle<Boon['kind']>(['seal', 'upgrade', 'purge', 'maxLife', 'pact', 'heal', 'card'], rng)) add(kind);
  // Arriba, a veces, una legendaria en el último puesto
  if (run.stage >= LEGENDARY_FROM_STAGE && rng() < LEGENDARY_CHANCE) {
    const legend: Boon = { kind: 'card', rank: pick(LEGENDARY_RANKS, rng) };
    const i = out.findIndex(b => b.kind === 'card');
    out[i >= 0 ? i : out.length - 1] = legend;
  }
  return out;
};

export const applyBoon = (run: CastleRun, boon: Boon): CastleRun => {
  const next: CastleRun = { ...run, deck: [...run.deck], offer: undefined, pact: false };
  switch (boon.kind) {
    case 'heal': next.lives = next.maxLives; break;
    // Lo que sale del mercader queda marcado (se pinta en azul eléctrico)
    case 'card': next.deck.push(boon.rank === 'WILD' ? { rank: 'SEAL', wild: true, merchant: true } : { rank: boon.rank, merchant: true }); break;
    case 'seal': next.deck[boon.target] = { ...next.deck[boon.target], seal: boon.seal, merchant: true }; break;
    case 'upgrade': next.deck[boon.target] = { ...next.deck[boon.target], bonus: (next.deck[boon.target].bonus ?? 0) + 2, merchant: true }; break;
    case 'purge': next.deck = next.deck.filter((_, i) => !boon.targets.includes(i)); break;
    case 'maxLife': next.maxLives += 1; next.lives += 1; break;
    case 'pact': next.pact = true; next.lives -= 1; break;
  }
  return next;
};

/** Eliges una mejora: se aplica y se guarda la subida */
export const chooseBoon = (index: number): CastleRun | null => {
  const state = getCastle();
  const boon = state.run?.offer?.[index];
  if (!state.run || !boon) return null;
  const run = { ...applyBoon(state.run, boon), stats: countBoon(state.run, boon) };
  save(withCheckpoint({ ...state, run, legendary: state.legendary || boonRarity(boon) === 'legendary' }, run));
  return run;
};

// --- COFRE (cada 3 pisos) ---
// Un "gacha": la rareza sale a suertes (40 % común, 45 % rara, 15 % legendaria) y luego
// un premio de esa rareza. Nunca trae el pacto (no es un regalo).
export const CHEST_EVERY = 3;
export const isChestFloor = (stage: number) => stage > 0 && stage % CHEST_EVERY === 0 && stage < CASTLE_LENGTH;

export const rollChest = (run: CastleRun, rng: Rng = Math.random): Boon => {
  const roll = rng();
  const rarity: Rarity = roll < 0.15 ? 'legendary' : roll < 0.6 ? 'rare' : 'common';
  if (rarity === 'legendary') return { kind: 'card', rank: pick(LEGENDARY_RANKS, rng) };
  const options: (Boon | null)[] = rarity === 'rare'
    ? [makeBoon('seal', run, rng), { kind: 'maxLife' }, { kind: 'card', rank: pick(RARE_CARDS, rng) }]
    : [makeBoon('heal', run, rng), { kind: 'card', rank: pick(CASTLE_RANKS.filter(r => !RARE_CARDS.includes(r)), rng) }, makeBoon('upgrade', run, rng)];
  const valid = options.filter((b): b is Boon => !!b);
  return valid.length ? pick(valid, rng) : { kind: 'maxLife' };
};

/** Abres el cofre: su premio se aplica y se guarda */
export const openChest = (): Boon | null => {
  const state = getCastle();
  const boon = state.run?.chest;
  if (!state.run || !boon) return null;
  // La oferta del mercader que ya estaba decidida se conserva
  const run = { ...applyBoon(state.run, boon), offer: state.run.offer, chest: undefined, stats: countBoon(state.run, boon, true) };
  save(withCheckpoint({ ...state, run, legendary: state.legendary || boonRarity(boon) === 'legendary' }, run));
  return boon;
};

// --- RESULTADO DE CADA PELEA ---

export type CastleOutcome = { kind: 'next'; run: CastleRun } | { kind: 'conquered'; challenges: ChallengeId[] }
  /** `checkpoint`: el piso (índice) desde el que puedes retomarla, si lo hay */
  | { kind: 'fallen'; stage: number; checkpoint?: number };

/** Vences al jefe de turno: subes un piso (o conquistas el Castillo) */
export const recordCastleWin = (livesLeft: number, rng: Rng = Math.random): CastleOutcome => {
  const state = getCastle();
  if (!state.run) return { kind: 'fallen', stage: 0 };
  const stage = state.run.stage + 1;
  if (stage >= CASTLE_LENGTH) {
    const n = state.run.challenges?.length ?? 0;
    save({ ...state, run: null, checkpoint: undefined, best: CASTLE_LENGTH, conquered: state.conquered + 1, bestChallenges: Math.max(state.bestChallenges ?? 0, n),
      lastSummary: summarize(state.run, 'conquered', CASTLE_LENGTH, livesLeft) });
    return { kind: 'conquered', challenges: state.run.challenges ?? [] };
  }
  const run: CastleRun = { ...state.run, stage, lives: livesLeft, pact: false };
  if (isChestFloor(stage)) run.chest = rollChest(run, rng);
  run.offer = offerBoons(run, rng);
  save({ ...state, run, best: Math.max(state.best, stage) });
  return { kind: 'next', run };
};

/** Caes (o empatas): la subida se acaba (pero si llegaste a un punto de guardado, se puede retomar) */
export const recordCastleLoss = (): CastleOutcome => {
  const state = getCastle();
  const stage = state.run?.stage ?? 0;
  save({ ...state, run: null, best: Math.max(state.best, stage), lastSummary: state.run ? summarize(state.run, 'fallen', stage, 0) : state.lastSummary });
  return { kind: 'fallen', stage, ...(state.checkpoint ? { checkpoint: state.checkpoint.stage } : {}) };
};
