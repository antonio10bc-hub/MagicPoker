// --- VERIFICACIÓN DEL BALANCE ACTUAL (lo que hay en lib/) ---
// Uso: node verify.mjs <shard> <shards> <salida.json>
import { writeFileSync } from 'node:fs';
import { BOSSES } from '@/lib/bosses';
import { ARCHETYPES } from '@/lib/forest';
import { seedRandom } from './engine';
import { PERSONA_INFO, PersonaId } from './personas';
import { bossMatch, campaign, forestMatch } from './scenarios';

const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const jobs: { id: string; run: () => unknown }[] = [];
const PS: PersonaId[] = ['novato', 'casual', 'experto', 'vidente'];
for (const p of PS) {
  BOSSES.forEach((_, b) => { for (let lv = 0; lv <= 4; lv++) jobs.push({ id: `boss:${p}:${b}:${lv}`, run: () => { let w = 0; const n = lv ? 250 : 600; for (let i = 0; i < n; i++) if (bossMatch(p, b, { level: lv }).result === 'win') w++; return w / n; } }); });
  ARCHETYPES.forEach(a => jobs.push({ id: `forest:${p}:${a.id}`, run: () => { let w = 0; const n = 400; for (let i = 0; i < n; i++) if (forestMatch(p, a.id).result === 'win') w++; return w / n; } }));
  jobs.push({ id: `campaign:${p}`, run: () => Array.from({ length: 150 }, () => { const c = campaign(p, PERSONA_INFO[p].patience, { castleTries: 3, forestDuels: 0 }); return { stuckAt: c.stuckAt, tries: c.bossTries }; }) });
}
const [shard, shards, out] = process.argv.slice(2);
const res: Record<string, unknown> = {};
jobs.filter((_, i) => i % Number(shards) === Number(shard)).forEach(j => { seedRandom(hash(j.id)); res[j.id] = j.run(); });
writeFileSync(out, JSON.stringify(res));
console.log(`[${shard}] listo`);
