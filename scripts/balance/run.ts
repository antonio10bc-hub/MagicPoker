// --- LANZADOR DE LA SIMULACIÓN DE BALANCEO ---
// Uso: node run.mjs <shard> <shards> <salida.json> [escala]
// Reparte la lista de experimentos entre procesos (cada uno, su trozo) y guarda los
// resultados agregados. Cada experimento lleva su semilla: es reproducible.
import { writeFileSync } from 'node:fs';
import { SealId } from '@/types';
import { BOSSES, ALL_SEALS, MAX_REMATCH_LEVEL } from '@/lib/bosses';
import { ChallengeId, CHALLENGES } from '@/lib/castle';
import { ARCHETYPES } from '@/lib/forest';
import { DeckConfig } from '@/lib/deck';
import { MatchResult, seedRandom } from './engine';
import { PERSONA_INFO, PERSONAS, PersonaId } from './personas';
import { bossMatch, campaign, castleRun, forestMatch } from './scenarios';

type Task =
  | { kind: 'boss'; id: string; persona: PersonaId; boss: number; level: number; n: number }
  | { kind: 'forest'; id: string; persona: PersonaId; arch: string; n: number }
  | { kind: 'castle'; id: string; persona: PersonaId; challenges: ChallengeId[]; n: number; deck?: string }
  | { kind: 'deck'; id: string; persona: PersonaId; deck: string; n: number }
  | { kind: 'campaign'; id: string; persona: PersonaId; n: number };

/** Mazos de prueba para medir lo que vale cada sello y quitar cartas */
export const DECKS: Record<string, DeckConfig> = {
  defecto: { seals: { shield: 1, double: 1, shift: 1, swap: 1, life: 1 }, removed: [] },
  sin_sellos: { seals: {}, removed: [] },
  sin_flojas: { seals: { shield: 1, double: 1, shift: 1, swap: 1, life: 1 }, removed: ['2', '3', '4'] },
  ...Object.fromEntries(ALL_SEALS.map(s => [`solo_${s}`, { seals: { [s]: 2 } as Partial<Record<SealId, number>>, removed: [] }])),
};

const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

export const buildTasks = (scale: number): Task[] => {
  const t: Task[] = [];
  const N = (n: number) => Math.max(10, Math.round(n * scale));
  for (const persona of PERSONAS) {
    // Jefes por primera vez, con el mazo que tendrías en ese momento
    BOSSES.forEach((_, boss) => t.push({ kind: 'boss', id: `boss:${persona}:${boss}:0`, persona, boss, level: 0, n: N(1000) }));
    // Revanchas (con todo desbloqueado)
    BOSSES.forEach((_, boss) => { for (let level = 1; level <= MAX_REMATCH_LEVEL; level++) t.push({ kind: 'boss', id: `boss:${persona}:${boss}:${level}`, persona, boss, level, n: N(300) }); });
    // El Bosque: cada arquetipo en su nivel
    ARCHETYPES.forEach(a => t.push({ kind: 'forest', id: `forest:${persona}:${a.id}`, persona, arch: a.id, n: N(600) }));
    // El Castillo: subidas enteras sin desafíos
    t.push({ kind: 'castle', id: `castle:${persona}:none`, persona, challenges: [], n: N(2000) });
    // La campaña entera
    t.push({ kind: 'campaign', id: `campaign:${persona}`, persona, n: N(300) });
  }
  // Desafíos del Castillo (los que pueden con él)
  for (const persona of ['experto', 'vidente', 'prudente'] as PersonaId[]) {
    for (const c of CHALLENGES) t.push({ kind: 'castle', id: `castle:${persona}:${c}`, persona, challenges: [c], n: N(1000) });
    t.push({ kind: 'castle', id: `castle:${persona}:all`, persona, challenges: [...CHALLENGES], n: N(1000) });
  }
  // Mazos: cuánto vale cada sello (contra el Soberano y contra el Bosque difícil)
  for (const persona of ['experto'] as PersonaId[]) {
    for (const deck of Object.keys(DECKS)) t.push({ kind: 'deck', id: `deck:${persona}:${deck}`, persona, deck, n: N(1500) });
    for (const deck of ['defecto', 'sin_flojas', 'sin_sellos']) t.push({ kind: 'castle', id: `castle:${persona}:none:${deck}`, persona, challenges: [], n: N(1000), deck });
  }
  return t;
};

interface MatchAgg { n: number; win: number; draw: number; loss: number; rounds: number; capped: number; openerP: number; openerPWin: number; openerOWin: number;
  livesOnWin: number; rivalLivesOnLoss: number; roundsHist: Record<number, number>; played: Record<string, number> }
const newAgg = (): MatchAgg => ({ n: 0, win: 0, draw: 0, loss: 0, rounds: 0, capped: 0, openerP: 0, openerPWin: 0, openerOWin: 0, livesOnWin: 0, rivalLivesOnLoss: 0, roundsHist: {}, played: {} });
const add = (a: MatchAgg, m: MatchResult) => {
  a.n++; a[m.result]++; a.rounds += m.rounds; if (m.capped) a.capped++;
  a.roundsHist[m.rounds] = (a.roundsHist[m.rounds] ?? 0) + 1;
  if (m.opener === 'player') { a.openerP++; if (m.result === 'win') a.openerPWin++; } else if (m.result === 'win') a.openerOWin++;
  if (m.result === 'win') a.livesOnWin += m.livesLeft; else if (m.result === 'loss') a.rivalLivesOnLoss += m.rivalLivesLeft;
  for (const [k, v] of Object.entries(m.played)) a.played[k] = (a.played[k] ?? 0) + v;
};

const runTask = (task: Task): unknown => {
  seedRandom(hash(task.id));
  switch (task.kind) {
    case 'boss': {
      const a = newAgg();
      for (let i = 0; i < task.n; i++) add(a, bossMatch(task.persona, task.boss, { level: task.level }));
      return a;
    }
    case 'forest': {
      const a = newAgg();
      for (let i = 0; i < task.n; i++) add(a, forestMatch(task.persona, task.arch));
      return a;
    }
    case 'deck': {
      // Contra el Soberano (todos los sellos) y contra los rivales difíciles del Bosque
      const vsSov = newAgg(), vsForest = newAgg();
      const hard = ARCHETYPES.filter(a => a.tier === 'hard' || a.tier === 'nightmare');
      for (let i = 0; i < task.n; i++) {
        add(vsSov, bossMatch(task.persona, BOSSES.length - 1, { defeated: BOSSES.length, config: DECKS[task.deck] }));
        add(vsForest, forestMatch(task.persona, hard[i % hard.length].id, undefined, DECKS[task.deck]));
      }
      return { vsSov, vsForest };
    }
    case 'castle': {
      const floors: number[] = Array(BOSSES.length + 1).fill(0);
      const reach: number[] = Array(BOSSES.length).fill(0);
      const deaths: number[] = Array(BOSSES.length).fill(0);
      const livesIn: number[] = Array(BOSSES.length).fill(0);
      const drawsAt: number[] = Array(BOSSES.length).fill(0);
      const boons: Record<string, number> = {};
      let conquered = 0, legendaryRuns = 0, legendaryConq = 0, maxLifeSum = 0;
      for (let i = 0; i < task.n; i++) {
        const r = castleRun(task.persona, { challenges: task.challenges, config: task.deck ? DECKS[task.deck] : undefined });
        floors[r.floors]++;
        r.floorsLog.forEach(f => { reach[f.stage]++; livesIn[f.stage] += f.livesIn; if (f.result !== 'win') deaths[f.stage]++; if (f.result === 'draw') drawsAt[f.stage]++; });
        if (r.conquered) conquered++;
        const legendary = r.boons.some(b => b.rarity === 'legendary');
        if (legendary) { legendaryRuns++; if (r.conquered) legendaryConq++; }
        r.boons.forEach(b => { boons[b.kind] = (boons[b.kind] ?? 0) + 1; });
        maxLifeSum += r.finalMax;
      }
      return { n: task.n, conquered, floors, reach, deaths, livesIn, drawsAt, boons, legendaryRuns, legendaryConq, maxLifeSum };
    }
    case 'campaign': {
      const players = [];
      for (let i = 0; i < task.n; i++) players.push(campaign(task.persona, PERSONA_INFO[task.persona].patience));
      return { players };
    }
  }
};

const [shard, shards, out, scaleArg] = process.argv.slice(2);
const scale = Number(scaleArg ?? 1);
const tasks = buildTasks(scale).filter((_, i) => i % Number(shards) === Number(shard));
const results: Record<string, unknown> = {};
const t0 = Date.now();
tasks.forEach((task, i) => {
  const t = Date.now();
  results[task.id] = { task, data: runTask(task) };
  if (process.env.VERBOSE) console.log(`[${shard}] ${i + 1}/${tasks.length} ${task.id} ${((Date.now() - t) / 1000).toFixed(1)}s`);
});
writeFileSync(out, JSON.stringify({ scale, results, seconds: (Date.now() - t0) / 1000 }));
console.log(`[${shard}] ${tasks.length} experimentos en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
