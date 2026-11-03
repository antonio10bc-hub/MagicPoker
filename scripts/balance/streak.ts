// --- RACHAS EN EL BOSQUE ---
// Uso: node streak.mjs <shard> <shards> <salida.json>
// % de victoria por duelo (con la dificultad que salga, como en el juego) por arquetipo.
import { writeFileSync } from 'node:fs';
import { rollEncounter } from '@/lib/forest';
import { seedRandom } from './engine';
import { PersonaId } from './personas';
import { forestMatch } from './scenarios';

const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const [shard, shards, out] = process.argv.slice(2);
const res: Record<string, unknown> = {};
(['casual', 'prudente', 'experto', 'vidente'] as PersonaId[]).forEach((p, i) => {
  if (i % Number(shards) !== Number(shard)) return;
  seedRandom(hash(p));
  const n = 4000; let w = 0, d = 0;
  for (let k = 0; k < n; k++) { const e = rollEncounter(); const r = forestMatch(p, e.id, e.tier).result; if (r === 'win') w++; else if (r === 'draw') d++; }
  res[p] = { win: w / n, draw: d / n };
});
writeFileSync(out, JSON.stringify(res));
