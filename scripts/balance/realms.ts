// --- LOS REINOS DEL BOSQUE ---
// Uso: node realms.mjs <shard> <shards> <salida.json>
// % de victoria por duelo de cada arquetipo en el bosque de siempre y en cada reino
// (para calibrar lo que suma cada victoria y las marcas que abren cada reino).
import { writeFileSync } from 'node:fs';
import { Realm, rollEncounter } from '@/lib/forest';
import { seedRandom } from './engine';
import { PersonaId } from './personas';
import { forestMatch } from './scenarios';

const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const [shard, shards, out, nArg] = process.argv.slice(2);
const n = Number(nArg ?? 1500);
const res: Record<string, Record<string, { win: number; draw: number }>> = {};
const jobs: [PersonaId, Realm | 'main'][] = [];
(['casual', 'prudente', 'experto', 'vidente'] as PersonaId[]).forEach(p => (['main', 'nightmare', 'unique', 'renegade'] as const).forEach(r => jobs.push([p, r])));
jobs.forEach(([p, r], i) => {
  if (i % Number(shards) !== Number(shard)) return;
  seedRandom(hash(p + r));
  let w = 0, d = 0;
  for (let k = 0; k < n; k++) {
    const e = rollEncounter(Math.random, r === 'main' ? undefined : r);
    const x = forestMatch(p, e.id, e.tier).result;
    if (x === 'win') w++; else if (x === 'draw') d++;
  }
  (res[p] ??= {})[r] = { win: w / n, draw: d / n };
});
writeFileSync(out, JSON.stringify(res));
