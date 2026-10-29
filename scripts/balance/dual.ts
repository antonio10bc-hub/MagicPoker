// --- ¿Y SI...? DOBLE MAZO (sellos aparte) ---
// Uso: node dual.mjs <regla> <shard> <shards> <salida.json>
// Compara la regla de robo con la de ahora: jefes, Bosque, Castillo, mazos y duración.
import { writeFileSync } from 'node:fs';
import { BOSSES } from '@/lib/bosses';
import { ARCHETYPES } from '@/lib/forest';
import { DeckConfig } from '@/lib/deck';
import { DrawRule, MatchResult, seedRandom, setDrawRule } from './engine';
import { PersonaId } from './personas';
import { bossMatch, castleRun, forestMatch } from './scenarios';

const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const [rule, shard, shards, out] = process.argv.slice(2);
setDrawRule(rule as DrawRule);

const FIVE: DeckConfig = { seals: { shield: 1, double: 1, shift: 1, swap: 1, life: 1 }, removed: [] };
const NONE: DeckConfig = { seals: {}, removed: [] };
type Agg = { n: number; win: number; draw: number; rounds: number };
const agg = (): Agg => ({ n: 0, win: 0, draw: 0, rounds: 0 });
const add = (a: Agg, m: MatchResult) => { a.n++; if (m.result === 'win') a.win++; if (m.result === 'draw') a.draw++; a.rounds += m.rounds; };

const jobs: { id: string; run: () => unknown }[] = [];
for (const persona of ['novato', 'casual', 'experto', 'vidente'] as PersonaId[]) {
  BOSSES.forEach((_, b) => jobs.push({ id: `boss:${persona}:${b}`, run: () => { const a = agg(); for (let i = 0; i < 500; i++) add(a, bossMatch(persona, b)); return a; } }));
}
for (const persona of ['casual', 'experto'] as PersonaId[]) {
  ARCHETYPES.forEach(ar => jobs.push({ id: `forest:${persona}:${ar.id}`, run: () => { const a = agg(); for (let i = 0; i < 400; i++) add(a, forestMatch(persona, ar.id)); return a; } }));
}
for (const persona of ['experto', 'vidente'] as PersonaId[]) {
  jobs.push({ id: `castle:${persona}`, run: () => {
    const n = 1500; let conq = 0; const floors = Array(13).fill(0);
    for (let i = 0; i < n; i++) { const r = castleRun(persona); floors[r.floors]++; if (r.conquered) conq++; }
    return { n, conq, floors };
  } });
}
// ¿Siguen restando los sellos? El Experto con 5 sellos y sin ninguno, contra el Soberano y el Bosque difícil
for (const [name, cfg] of [['cinco', FIVE], ['ninguno', NONE]] as [string, DeckConfig][]) {
  jobs.push({ id: `deck:${name}`, run: () => {
    const sov = agg(), fo = agg(); const hard = ARCHETYPES.filter(a => a.tier === 'hard' || a.tier === 'nightmare');
    for (let i = 0; i < 1500; i++) { add(sov, bossMatch('experto', BOSSES.length - 1, { defeated: BOSSES.length, config: cfg })); add(fo, forestMatch('experto', hard[i % hard.length].id, undefined, cfg)); }
    return { sov, fo };
  } });
}
const res: Record<string, unknown> = {};
jobs.filter((_, i) => i % Number(shards) === Number(shard)).forEach(j => { seedRandom(hash(j.id)); res[j.id] = j.run(); });
writeFileSync(out, JSON.stringify(res));
console.log(`[${rule} ${shard}] listo`);
