// --- EL CASTILLO DE AHORA (IA normal en 6 pisos, guardado en 4 y 8) Y SUS DESAFÍOS ---
// Uso: node castle3.mjs <shard> <shards> <salida.json>
// Por cada desafío (y sin ninguno): % de subidas que lo conquistan de una tirada y
// cuántos intentos hacen falta retomando desde los puntos de guardado.
import { writeFileSync } from 'node:fs';
import { ChallengeId, CHALLENGES } from '@/lib/castle';
import { seedRandom } from './engine';
import { PersonaId } from './personas';
import { castleRun } from './scenarios';

const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const SETS: Record<string, ChallengeId[]> = {
  ninguno: [], ...Object.fromEntries(CHALLENGES.map(c => [c, [c]])),
  cinco_sin_caer: CHALLENGES.filter(c => c !== 'noDeath'), todos: [...CHALLENGES],
};
const jobs: { id: string; run: () => unknown }[] = [];
for (const persona of ['casual', 'experto', 'vidente'] as PersonaId[]) for (const [name, ch] of Object.entries(SETS)) {
  jobs.push({ id: `single:${persona}:${name}`, run: () => {
    const n = 1000; let conq = 0; let floors = 0;
    for (let i = 0; i < n; i++) { const r = castleRun(persona, { challenges: ch }); floors += r.floors; if (r.conquered) conq++; }
    return { n, conq, floors: floors / n };
  } });
  jobs.push({ id: `attempts:${persona}:${name}`, run: () => {
    const players = 200, cap = 40; const tries: number[] = [];
    for (let p = 0; p < players; p++) {
      let from; let t = 1;
      for (; t <= cap; t++) {
        const r = castleRun(persona, { challenges: ch, from, useCheckpoints: true });
        if (r.conquered) break;
        from = r.saved;
      }
      tries.push(t);
    }
    return { players, cap, tries };
  } });
}
const [shard, shards, out] = process.argv.slice(2);
const res: Record<string, unknown> = {};
jobs.filter((_, i) => i % Number(shards) === Number(shard)).forEach(j => { seedRandom(hash(j.id)); res[j.id] = j.run(); });
writeFileSync(out, JSON.stringify(res));
console.log(`[${shard}] listo`);
