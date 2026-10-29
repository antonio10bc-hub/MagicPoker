// --- ¿POR QUÉ LOS SELLOS RESTAN? ---
// Uso: node seals.mjs <salida.json>
// El Experto contra el Soberano y contra el Bosque difícil con variantes del mismo mazo:
// sellos que nunca juega (solo ocupan robos), sin sellos y con los sellos en un mazo
// aparte (como el Soberano: cada ronda roba una carta y un sello).
import { writeFileSync } from 'node:fs';
import { Card } from '@/types';
import { BOSSES, bossLives, createBossState } from '@/lib/bosses';
import { buildDeckFrom } from '@/lib/deck';
import { createDeck, createPlayerState, createSealCard, isSealCard, shuffle, withSealDeck } from '@/lib/game-utils';
import { ARCHETYPES, buildForestDeck, FOREST_LIVES, forestAi } from '@/lib/forest';
import { STARTING_HAND_SIZE } from '@/lib/constants';
import { Chooser, playerStart, playMatch, rivalAi, seedRandom } from './engine';
import { chooserOf } from './personas';

const FIVE = { shield: 1, double: 1, shift: 1, swap: 1, life: 1 } as const;
const expert = chooserOf('experto');
/** El mismo Experto, pero sin jugar nunca un sello */
const noSeals: Chooser = v => expert({ ...v, hand: v.hand.filter(c => !isSealCard(c)) });

type Variant = { name: string; player: () => ReturnType<typeof playerStart>; bot: Chooser; cantrip?: boolean; extra?: number };
const sealCards = (): Card[] => (Object.keys(FIVE) as (keyof typeof FIVE)[]).map(s => createSealCard('player', s));
const variants: Variant[] = [
  { name: 'defecto', player: () => playerStart(buildDeckFrom({ seals: { ...FIVE }, removed: [] })), bot: expert },
  { name: 'sellos_sin_jugar', player: () => playerStart(buildDeckFrom({ seals: { ...FIVE }, removed: [] })), bot: noSeals },
  { name: 'sin_sellos', player: () => playerStart(buildDeckFrom({ seals: {}, removed: [] })), bot: expert },
  { name: 'mazo_aparte', player: () => withSealDeck({ ...createPlayerState(shuffle(createDeck('player')), STARTING_HAND_SIZE, true, 4), maxLives: 4 }, shuffle(sealCards()), true), bot: expert },
  // ¿Y si...? El sello se repone al robarlo / mazo aparte robando 2 cartas y 1 sello
  { name: 'sello_se_repone', player: () => playerStart(buildDeckFrom({ seals: { ...FIVE }, removed: [] })), bot: expert, cantrip: true },
  { name: 'aparte_2_cartas', player: () => withSealDeck({ ...createPlayerState(shuffle(createDeck('player')), STARTING_HAND_SIZE, true, 4), maxLives: 4 }, shuffle(sealCards()), true), bot: expert, extra: 1 },
];
const sov = BOSSES[BOSSES.length - 1];
const hard = ARCHETYPES.filter(a => a.tier === 'hard' || a.tier === 'nightmare');
const out: Record<string, { sov: number; forest: number; n: number }> = {};
for (const v of variants) {
  seedRandom(42);
  let s = 0, f = 0; const n = 3000;
  for (let i = 0; i < n; i++) {
    if (playMatch({ player: v.player(), opponent: createBossState(sov, 0, bossLives(sov, 0), STARTING_HAND_SIZE), bot: v.bot, rival: rivalAi('hard'), sealCantrip: v.cantrip, extraDraw: v.extra }).result === 'win') s++;
    const a = hard[i % hard.length];
    if (playMatch({ player: v.player(), opponent: createPlayerState(buildForestDeck(a), STARTING_HAND_SIZE, false, FOREST_LIVES[a.tier]), bot: v.bot, rival: rivalAi(forestAi(a.tier)), sealCantrip: v.cantrip, extraDraw: v.extra }).result === 'win') f++;
  }
  out[v.name] = { sov: s / n, forest: f / n, n };
  console.log(v.name, (100 * s / n).toFixed(1), (100 * f / n).toFixed(1));
}
// Y al revés: el Soberano y un jefe normal sin sus sellos
seedRandom(43);
let a = 0, b = 0; const n = 3000;
const wall = BOSSES[6];
for (let i = 0; i < n; i++) {
  const plain = createPlayerState(shuffle(createDeck('opponent')), STARTING_HAND_SIZE, false, bossLives(wall, 0));
  if (playMatch({ player: playerStart(buildDeckFrom({ seals: { ...FIVE }, removed: [] })), opponent: plain, bot: expert, rival: rivalAi('hard') }).result === 'win') a++;
  if (playMatch({ player: playerStart(buildDeckFrom({ seals: { ...FIVE }, removed: [] })), opponent: createBossState(wall, 0, bossLives(wall, 0), STARTING_HAND_SIZE), bot: expert, rival: rivalAi('hard') }).result === 'win') b++;
}
out['espejista_sin_sellos'] = { sov: a / n, forest: 0, n }; out['espejista_con_sellos'] = { sov: b / n, forest: 0, n };
console.log('espejista sin sellos', (100 * a / n).toFixed(1), 'con sellos', (100 * b / n).toFixed(1));
writeFileSync(process.argv[2], JSON.stringify(out));
