// --- ESCENARIOS: jefes, revanchas, Castillo, Bosque y la campaña entera ---
// Montan cada partida como la tienda (mismo mazo, mismas vidas, misma IA del rival).
import { Card, SealId } from '@/types';
import { BOSSES, bossLives, createBossState } from '@/lib/bosses';
import { buildDeckFrom, DeckConfig, defaultDeckConfig, MAX_SEALS, sanitizeDeckConfig } from '@/lib/deck';
import {
  applyBoon, buildRunDeck, CardTemplate, castleAi, castleBossLevel, CHECKPOINT_STAGES, castleBossLives, CastleRun, ChallengeId, CHALLENGES, isChestFloor, offerBoons, rollChest, boonRarity,
} from '@/lib/castle';
import { ARCHETYPES, archetype, buildForestDeck, FOREST_LIVES, forestAi, rollEncounter, Tier } from '@/lib/forest';
import { createDualState, DECK_RANKS, LEGENDARY_RANKS, RANKS } from '@/lib/game-utils';

const LEGENDS = LEGENDARY_RANKS;
import { STARTING_HAND_SIZE, STARTING_LIVES } from '@/lib/constants';
import { MatchResult, playerStart, playMatch, rivalAi } from './engine';
import { chooserOf, PersonaId, pickBoon, seesAll } from './personas';


/** Sellos desbloqueados tras vencer a `defeated` jefes */
export const sealsAfter = (defeated: number): SealId[] => BOSSES.slice(0, defeated).flatMap(b => (b.seal ? [b.seal] : []));

/** Mazo del jugador: sin editor (antes del Muro), el estándar y un sello de cada; luego, la configuración */
export const deckFor = (defeated: number, config?: DeckConfig): Card[] => {
  const seals = sealsAfter(defeated);
  if (defeated < 2) return buildDeckFrom({ seals: Object.fromEntries(seals.map(s => [s, 1])), removed: [] });
  return buildDeckFrom(sanitizeDeckConfig(config ?? defaultDeckConfig(seals), seals));
};

/** Una partida contra un jefe (la primera vez, o en revancha de nivel `level`) */
export const bossMatch = (persona: PersonaId, bossIndex: number, opts: { level?: number; defeated?: number; config?: DeckConfig; cantrip?: boolean; ai?: 'normal' | 'hard'; lives?: number } = {}): MatchResult => {
  const boss = BOSSES[bossIndex];
  const level = opts.level ?? 0;
  const rematch = level > 0;
  const defeated = opts.defeated ?? (rematch ? BOSSES.length : bossIndex);
  return playMatch({
    player: playerStart(deckFor(defeated, opts.config)),
    opponent: createBossState(boss, level, opts.lives ?? bossLives(boss, level), STARTING_HAND_SIZE),
    bot: chooserOf(persona), botSeesAll: seesAll(persona),
    rival: rivalAi(opts.ai ?? (rematch ? 'hard' : 'normal')),
    sealCantrip: opts.cantrip, rivalCantrip: opts.cantrip,
  });
};

// --- EL CASTILLO ---
/** Mazo inicial de la subida: el del editor (como startingDeck del Castillo) */
const startingTemplates = (config: DeckConfig, challenges: ChallengeId[]): CardTemplate[] => {
  const removed = new Set(config.removed);
  let deck: CardTemplate[] = [
    ...DECK_RANKS.filter(r => !removed.has(r)).map(rank => ({ rank })),
    ...(Object.entries(config.seals) as [SealId, number][]).flatMap(([seal, n]) => Array.from({ length: n }, () => ({ rank: 'SEAL' as const, seal }))),
  ];
  if (challenges.includes('short')) {
    const weakest = deck.map((c, i) => ({ c, i })).filter(({ c }) => c.rank !== 'SEAL')
      .sort((a, b) => RANKS[a.c.rank].value - RANKS[b.c.rank].value).slice(0, 4).map(w => w.i);
    deck = deck.filter((_, i) => !weakest.includes(i));
  }
  return deck;
};

export interface FloorLog { stage: number; result: MatchResult['result']; livesIn: number; livesOut: number; rounds: number; bossLives: number; level: number }
export interface CastleRunResult {
  conquered: boolean;
  /** Pisos vencidos (0–12) */
  floors: number;
  floorsLog: FloorLog[];
  boons: { kind: string; rarity: string }[];
  finalDeckSize: number;
  finalLives: number;
  finalMax: number;
  /** Punto de guardado alcanzado (para retomar desde ahí): la subida al llegar a ese piso */
  saved?: CastleRun;
}

/** Una subida entera al Castillo */
/** Cambios hipotéticos para probar (no están en el juego): vidas y nivel de los jefes, curación por piso */
export interface CastleTweaks { bossLivesDelta?: number; levelDelta?: number; healPerFloor?: number; startLives?: number; sealCantrip?: boolean; floors?: number; normalAiUntil?: number; legendaryFrom?: number }

export const castleRun = (persona: PersonaId, opts: { challenges?: ChallengeId[]; config?: DeckConfig; tweaks?: CastleTweaks; from?: CastleRun; checkpoints?: number[]; useCheckpoints?: boolean } = {}): CastleRunResult => {
  const tw = opts.tweaks ?? {};
  const challenges = CHALLENGES.filter(c => opts.challenges?.includes(c));
  const all = sealsAfter(BOSSES.length);
  const config = sanitizeDeckConfig(opts.config ?? defaultDeckConfig(all), all);
  const lives = (tw.startLives ?? STARTING_LIVES) - (challenges.includes('fragile') ? 1 : 0);
  let run: CastleRun = opts.from ? { ...opts.from, lives: opts.from.maxLives } : { stage: 0, lives, maxLives: lives, deck: startingTemplates(config, challenges), ...(challenges.length ? { challenges } : {}) };
  let saved: CastleRun | undefined = opts.from;
  const floorsLog: FloorLog[] = [];
  const boons: CastleRunResult['boons'] = [];
  for (;;) {
    const boss = BOSSES[run.stage];
    const level = Math.max(0, Math.min(4, castleBossLevel(run.stage, run) + (tw.levelDelta ?? 0)));
    const bl = Math.max(1, castleBossLives(run) + (tw.bossLivesDelta ?? 0));
    const m = playMatch({
      player: { ...createDualState(buildRunDeck(run), STARTING_HAND_SIZE, true, run.lives), maxLives: run.maxLives },
      opponent: createBossState(boss, level, bl, STARTING_HAND_SIZE),
      bot: chooserOf(persona), botSeesAll: seesAll(persona),
      rival: rivalAi(tw.normalAiUntil !== undefined ? (run.stage < tw.normalAiUntil ? 'normal' : 'hard') : castleAi(run.stage, run)),
      sovereignPhase2: boss.id === 'sovereign',
      sealCantrip: tw.sealCantrip, rivalCantrip: tw.sealCantrip,
    });
    floorsLog.push({ stage: run.stage, result: m.result, livesIn: run.lives, livesOut: m.livesLeft, rounds: m.rounds, bossLives: bl, level });
    if (m.result !== 'win') {
      return { conquered: false, floors: run.stage, floorsLog, boons, finalDeckSize: run.deck.length, finalLives: 0, finalMax: run.maxLives, saved };
    }
    const stage = run.stage + 1;
    if (stage >= (tw.floors ?? BOSSES.length)) {
      return { conquered: true, floors: BOSSES.length, floorsLog, boons, finalDeckSize: run.deck.length, finalLives: m.livesLeft, finalMax: run.maxLives };
    }
    run = { ...run, stage, lives: Math.min(run.maxLives, m.livesLeft + (tw.healPerFloor ?? 0)), pact: false };
    // Cofre cada 3 pisos (se abre antes de elegir la mejora) y la oferta del mercader
    const offer = offerBoons(run);
    // ¿Y si...? Legendarias antes: desde este piso, a veces, una en la oferta
    if (tw.legendaryFrom !== undefined && stage >= tw.legendaryFrom && stage < 6 && Math.random() < 0.3) offer[offer.length - 1] = { kind: 'card', rank: LEGENDS[Math.floor(Math.random() * LEGENDS.length)] };
    if (isChestFloor(stage)) {
      const chest = rollChest(run);
      boons.push({ kind: `cofre:${chest.kind}`, rarity: boonRarity(chest) });
      run = { ...applyBoon(run, chest), offer };
    }
    const i = pickBoon(persona, run, offer);
    if (i >= 0) {
      boons.push({ kind: offer[i].kind === 'card' ? `carta:${(offer[i] as { rank: string }).rank}` : offer[i].kind, rarity: boonRarity(offer[i]) });
      run = applyBoon(run, offer[i]);
    }
    if ((opts.checkpoints ?? (opts.from !== undefined || opts.useCheckpoints ? CHECKPOINT_STAGES : [])).includes(run.stage) && !run.challenges?.includes('noDeath')) saved = { ...run };
  }
};

// --- EL BOSQUE ---
/** Un duelo del Bosque contra un arquetipo (en su nivel) */
export const forestMatch = (persona: PersonaId, id: string, tier?: Tier, config?: DeckConfig): MatchResult => {
  const a = archetype(id)!;
  const t = tier ?? a.tier;
  return playMatch({
    player: playerStart(deckFor(BOSSES.length, config)),
    opponent: createDualState(buildForestDeck(a, t), STARTING_HAND_SIZE, false, FOREST_LIVES[t]),
    bot: chooserOf(persona), botSeesAll: seesAll(persona),
    rival: rivalAi(forestAi(t)),
  });
};

// --- LA CAMPAÑA ENTERA (un jugador de principio a fin) ---
export interface CampaignResult {
  /** Intentos que necesitó cada jefe (hasta el tope); null si no llegó */
  bossTries: (number | null)[];
  /** Se atascó (superó su paciencia) en este jefe; null si los venció a todos */
  stuckAt: number | null;
  castleTries: number | null;
  castleBest: number;
  castleConquered: boolean;
  forest: { tier: Tier; win: boolean }[];
  totalMatches: number;
}

/**
 * Juega como alguien de verdad: cada jefe hasta vencerlo (con su paciencia de intentos
 * seguidos sin ganar), luego subidas al Castillo hasta conquistarlo y unos duelos en el
 * Bosque. `patience` = intentos seguidos que aguanta antes de dejarlo.
 */
export const campaign = (persona: PersonaId, patience: number, opts: { castleTries?: number; forestDuels?: number; config?: DeckConfig } = {}): CampaignResult => {
  const bossTries: (number | null)[] = BOSSES.map(() => null);
  let total = 0;
  for (let i = 0; i < BOSSES.length; i++) {
    let tries = 0;
    for (;;) {
      tries++;
      total++;
      const m = bossMatch(persona, i, { defeated: i, config: opts.config });
      if (m.result === 'win') break;
      if (tries >= patience) {
        bossTries[i] = null;
        return { bossTries, stuckAt: i, castleTries: null, castleBest: 0, castleConquered: false, forest: [], totalMatches: total };
      }
    }
    bossTries[i] = tries;
  }
  // El Castillo: subidas hasta conquistarlo (con su paciencia, en subidas)
  let castleBest = 0;
  let castleTries: number | null = null;
  const maxRuns = opts.castleTries ?? Math.max(5, patience);
  for (let r = 1; r <= maxRuns; r++) {
    const run = castleRun(persona, { config: opts.config });
    total += run.floorsLog.length;
    castleBest = Math.max(castleBest, run.floors);
    if (run.conquered) { castleTries = r; break; }
  }
  if (castleTries === null) return { bossTries, stuckAt: null, castleTries: null, castleBest, castleConquered: false, forest: [], totalMatches: total };
  // El Bosque: duelos con quien salga
  const forest: CampaignResult['forest'] = [];
  for (let d = 0; d < (opts.forestDuels ?? 20); d++) {
    const e = rollEncounter();
    const m = forestMatch(persona, e.id, e.tier, opts.config);
    total++;
    forest.push({ tier: e.tier, win: m.result === 'win' });
  }
  return { bossTries, stuckAt: null, castleTries, castleBest, castleConquered: true, forest, totalMatches: total };
};

export { ARCHETYPES, MAX_SEALS };
