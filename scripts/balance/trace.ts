import { seedRandom, playMatch, playerStart, rivalAi, Chooser } from './engine';
import { chooserOf } from './personas';
import { deckFor } from './scenarios';
import { BOSSES, bossLives, createBossState } from '@/lib/bosses';
seedRandom(3);
const wrap = (name: string, c: Chooser): Chooser => v => {
  const m = c(v);
  const card = m && v.hand.find(h => h.id === m.cardId);
  console.log(`  ${name} vidas ${v.lives}-${v.theirLives} mano[${v.hand.map(h => h.rank === 'SEAL' ? 's:' + h.seal : h.rank).join(',')}] mesa[${v.mine.map(s => s.card ? s.card.rank : '_').join(',')}] rival[${v.theirs.map(s => s.card ? (s.card.hidden ? '?' : s.card.rank) : '_').join(',')}] -> ${m ? (card?.rank === 'SEAL' ? 's:' + card.seal : card?.rank) + '@' + m.slotIndex : 'PLANTA'}`);
  return m;
};
for (let g = 0; g < 2; g++) {
  const boss = BOSSES[0];
  const r = playMatch({ player: playerStart(deckFor(0)), opponent: createBossState(boss, 0, bossLives(boss, 0), 3), bot: wrap('BOT', chooserOf('experto')), rival: wrap('IA ', rivalAi('normal')) });
  console.log('RESULT', r.result, r.rounds, r.livesLeft, r.rivalLivesLeft);
}
