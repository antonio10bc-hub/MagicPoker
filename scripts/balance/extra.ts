// --- CALIBRACIÓN Y "¿Y SI...?" DEL CASTILLO ---
// Uso: node extra.mjs <shard> <shards> <salida.json>
import { writeFileSync } from 'node:fs';
import { createDeck, createPlayerState } from '@/lib/game-utils';
import { STARTING_HAND_SIZE } from '@/lib/constants';
import { playerStart, playMatch, rivalAi, seedRandom } from './engine';
import { chooserOf, PersonaId, seesAll } from './personas';
import { castleRun, CastleTweaks } from './scenarios';

const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

const WHATIF: Record<string, CastleTweaks> = {
  actual: {},
  jefes_menos1vida: { bossLivesDelta: -1 },
  cura1_por_piso: { healPerFloor: 1 },
  jefes_menos1nivel: { levelDelta: -1 },
  menos1vida_y_cura1: { bossLivesDelta: -1, healPerFloor: 1 },
  cura2_por_piso: { healPerFloor: 2 },
  empiezas_6_vidas: { startLives: 6 },
};

type Job = { id: string; run: () => unknown };
const jobs: Job[] = [];
// Calibración: el bot contra la misma IA, mismo mazo estándar sin sellos y mismas vidas
for (const [persona, diff] of [['experto', 'hard'], ['casual', 'normal'], ['novato', 'easy'], ['vidente', 'hard']] as [PersonaId, 'hard' | 'normal' | 'easy'][]) {
  jobs.push({ id: `mirror:${persona}:${diff}`, run: () => {
    let win = 0, draw = 0, openerWin = 0, opener = 0; const n = 3000;
    for (let i = 0; i < n; i++) {
      const m = playMatch({ player: playerStart(createDeck('player')), opponent: createPlayerState(createDeck('opponent'), STARTING_HAND_SIZE, false, 4),
        bot: chooserOf(persona), botSeesAll: seesAll(persona), rival: rivalAi(diff) });
      if (m.result === 'win') win++; if (m.result === 'draw') draw++;
      if (m.opener === 'player') { opener++; if (m.result === 'win') openerWin++; }
    }
    return { n, win, draw, opener, openerWin };
  } });
}
for (const persona of ['casual', 'experto', 'vidente'] as PersonaId[]) for (const [name, tw] of Object.entries(WHATIF)) {
  jobs.push({ id: `whatif:${persona}:${name}`, run: () => {
    const n = 1500; let conq = 0; const floors = Array(13).fill(0);
    for (let i = 0; i < n; i++) { const r = castleRun(persona, { tweaks: tw }); floors[r.floors]++; if (r.conquered) conq++; }
    return { n, conq, floors };
  } });
}
const [shard, shards, out] = process.argv.slice(2);
const res: Record<string, unknown> = {};
jobs.filter((_, i) => i % Number(shards) === Number(shard)).forEach(j => { seedRandom(hash(j.id)); res[j.id] = j.run(); });
writeFileSync(out, JSON.stringify(res));
console.log(`[${shard}] listo`);
