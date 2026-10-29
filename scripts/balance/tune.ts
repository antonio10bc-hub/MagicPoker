// --- AJUSTE DE JEFES Y BOSQUE (con las reglas de ahora) ---
// Uso: node tune.mjs <shard> <shards> <salida.json>
// Prueba, para cada jefe, IA normal o difícil y distintas vidas; para cada nivel del
// Bosque, IA, vidas y copias de sellos. Mide victorias del Novato, el Casual y el Experto.
import { writeFileSync } from 'node:fs';
import { BOSSES } from '@/lib/bosses';
import { ARCHETYPES, Archetype, Tier } from '@/lib/forest';
import { createCard, createDeck, createDualState, createSealCard, shuffle } from '@/lib/game-utils';
import { STARTING_HAND_SIZE } from '@/lib/constants';
import { playerStart, playMatch, rivalAi, seedRandom } from './engine';
import { chooserOf, PersonaId, seesAll } from './personas';
import { bossMatch, deckFor } from './scenarios';

const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const PERSONAS: PersonaId[] = ['novato', 'casual', 'experto'];
const jobs: { id: string; run: () => unknown }[] = [];

BOSSES.forEach((b, i) => {
  const lives = b.secret ? [5, 6, 7, 8] : [3, 4, 5, 6];
  for (const ai of ['normal', 'hard'] as const) for (const l of lives) for (const p of PERSONAS) {
    jobs.push({ id: `boss:${i}:${ai}:${l}:${p}`, run: () => { let w = 0; const n = 400; for (let k = 0; k < n; k++) if (bossMatch(p, i, { ai, lives: l }).result === 'win') w++; return w / n; } });
  }
});

/** Mazo del Bosque con copias a medida (como buildForestDeck) */
const forestDeck = (a: Archetype, seals: number, cards: number) => {
  const royal = a.royal;
  const base = royal ? [...createDeck('opponent').filter(c => !['J', 'Q', 'K'].includes(c.rank)), ...Array.from({ length: 3 }, () => createCard('opponent', royal))] : createDeck('opponent');
  return shuffle([...base, ...a.seals.flatMap(s => Array.from({ length: seals }, () => createSealCard('opponent', s))), ...a.cards.flatMap(r => Array.from({ length: cards }, () => createCard('opponent', r)))]);
};
const CARD_COPIES: Record<Tier, number> = { normal: 0, hard: 1, nightmare: 2, unique: 0, renegade: 0 };
for (const tier of ['normal', 'hard', 'nightmare', 'unique', 'renegade'] as Tier[]) {
  const arch = ARCHETYPES.filter(a => a.tier === tier);
  for (const ai of ['normal', 'hard'] as const) for (const lives of [4, 5, 6, 7, 8]) for (const seals of tier === 'renegade' ? [1, 2] : [1, 2, 3]) for (const p of ['casual', 'experto'] as PersonaId[]) {
    if (tier !== 'normal' && ai === 'normal') continue;
    jobs.push({ id: `forest:${tier}:${ai}:${lives}:${seals}:${p}`, run: () => {
      let w = 0; const n = 400;
      for (let k = 0; k < n; k++) {
        const a = arch[k % arch.length];
        const m = playMatch({ player: playerStart(deckFor(BOSSES.length)), opponent: createDualState(forestDeck(a, seals, CARD_COPIES[tier]), STARTING_HAND_SIZE, false, lives),
          bot: chooserOf(p), botSeesAll: seesAll(p), rival: rivalAi(ai) });
        if (m.result === 'win') w++;
      }
      return w / n;
    } });
  }
}
const [shard, shards, out] = process.argv.slice(2);
const res: Record<string, unknown> = {};
jobs.filter((_, i) => i % Number(shards) === Number(shard)).forEach(j => { seedRandom(hash(j.id)); res[j.id] = j.run(); });
writeFileSync(out, JSON.stringify(res));
console.log(`[${shard}] ${Object.keys(res).length} listo`);
