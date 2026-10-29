// --- EL CASTILLO CON LAS REGLAS NUEVAS: ¿POR QUÉ ES IMPOSIBLE Y QUÉ LO ARREGLA? ---
// Uso: node castle2.mjs <shard> <shards> <salida.json>
// Subidas enteras con cambios posibles, y "puntos de guardado" (si caes, retomas desde el
// último piso de guardado alcanzado, con tu mazo de entonces y las vidas llenas): cuántos
// intentos hacen falta para conquistarlo.
import { writeFileSync } from 'node:fs';
import { seedRandom } from './engine';
import { PersonaId } from './personas';
import { castleRun, CastleTweaks } from './scenarios';

const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const WHATIF: Record<string, CastleTweaks> = {
  actual: {},
  jefes_menos1vida: { bossLivesDelta: -1 },
  ia_normal_4: { normalAiUntil: 4 },
  ia_normal_8: { normalAiUntil: 8 },
  cura1: { healPerFloor: 1 },
  empezar_6: { startLives: 6 },
  legendarias_desde_3: { legendaryFrom: 3 },
  combinada: { bossLivesDelta: -1, normalAiUntil: 4, healPerFloor: 1 },
  combinada_suave: { normalAiUntil: 6, healPerFloor: 1 },
};
const jobs: { id: string; run: () => unknown }[] = [];
for (const persona of ['casual', 'experto', 'vidente'] as PersonaId[]) {
  for (const [name, tw] of Object.entries(WHATIF)) {
    jobs.push({ id: `whatif:${persona}:${name}`, run: () => {
      const n = 1200; let conq = 0; const floors = Array(13).fill(0); const hazard = Array(12).fill(0), reach = Array(12).fill(0);
      for (let i = 0; i < n; i++) {
        const r = castleRun(persona, { tweaks: tw }); floors[r.floors]++; if (r.conquered) conq++;
        r.floorsLog.forEach(f => { reach[f.stage]++; if (f.result !== 'win') hazard[f.stage]++; });
      }
      return { n, conq, floors, hazard, reach };
    } });
  }
  // Puntos de guardado en los pisos 4 y 8 (con y sin la combinada): intentos hasta conquistar
  for (const [name, tw] of [['guardado', {}], ['guardado_y_combinada_suave', WHATIF.combinada_suave]] as [string, CastleTweaks][]) {
    jobs.push({ id: `checkpoint:${persona}:${name}`, run: () => {
      const players = 300, cap = 60; const tries: number[] = [];
      for (let p = 0; p < players; p++) {
        let from; let t = 0;
        for (; t < cap; t++) {
          const r = castleRun(persona, { tweaks: tw, from, checkpoints: [4, 8] });
          if (r.conquered) break;
          from = r.saved;
        }
        tries.push(t + 1);
      }
      return { players, cap, tries };
    } });
  }
}
const [shard, shards, out] = process.argv.slice(2);
const res: Record<string, unknown> = {};
jobs.filter((_, i) => i % Number(shards) === Number(shard)).forEach(j => { seedRandom(hash(j.id)); res[j.id] = j.run(); });
writeFileSync(out, JSON.stringify(res));
console.log(`[${shard}] listo`);
