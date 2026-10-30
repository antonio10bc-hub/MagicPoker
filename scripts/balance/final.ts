// --- FOTO FINAL DEL BALANCEO: % de victorias de cada parte del juego por arquetipo ---
// Uso: node final.mjs <shard> <shards> <salida.json>
import { writeFileSync } from 'node:fs';
import { BOSSES } from '@/lib/bosses';
import { ARCHETYPES, Tier } from '@/lib/forest';
import { seedRandom } from './engine';
import { PERSONA_INFO, PERSONAS } from './personas';
import { bossMatch, campaign, castleRun, forestMatch } from './scenarios';

const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const TIERS: Tier[] = ['normal', 'hard', 'nightmare', 'unique', 'renegade'];
const jobs: { id: string; run: () => unknown }[] = [];
for (const p of PERSONAS) {
  BOSSES.forEach((_, i) => jobs.push({ id: `boss:${p}:${i}`, run: () => {
    const n = 1500; let w = 0;
    for (let k = 0; k < n; k++) if (bossMatch(p, i, { defeated: i }).result === 'win') w++;
    return w / n;
  } }));
  jobs.push({ id: `castle:${p}`, run: () => {
    const n = 800; let c = 0; let floors = 0;
    for (let k = 0; k < n; k++) { const r = castleRun(p); floors += r.floors; if (r.conquered) c++; }
    return { conq: c / n, floors: floors / n };
  } });
  jobs.push({ id: `castle10:${p}`, run: () => {
    const players = 200; let ok = 0;
    for (let q = 0; q < players; q++) {
      let from;
      for (let t = 1; t <= 10; t++) { const r = castleRun(p, { from, useCheckpoints: true }); if (r.conquered) { ok++; break; } from = r.saved; }
    }
    return ok / players;
  } });
  for (const t of TIERS) jobs.push({ id: `forest:${p}:${t}`, run: () => {
    const arch = ARCHETYPES.filter(a => a.tier === t); const n = 400; let w = 0;
    for (const a of arch) for (let k = 0; k < n; k++) if (forestMatch(p, a.id).result === 'win') w++;
    return w / (n * arch.length);
  } });
  jobs.push({ id: `campaign:${p}`, run: () => {
    const n = 300; let bosses = 0;
    for (let k = 0; k < n; k++) if (campaign(p, PERSONA_INFO[p].patience, { castleTries: 0, forestDuels: 0 }).stuckAt === null) bosses++;
    return bosses / n;
  } });
}
const [shard, shards, out] = process.argv.slice(2);
const res: Record<string, unknown> = {};
jobs.filter((_, i) => i % Number(shards) === Number(shard)).forEach(j => { seedRandom(hash(j.id)); res[j.id] = j.run(); });
writeFileSync(out, JSON.stringify(res));
console.log(`[${shard}] listo`);
