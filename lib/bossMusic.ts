// --- MÚSICA DE CADA JEFE ---
// El mismo western nocturno de la partida (lib/music.ts) con otro carácter según el
// jefe: tono, tempo, timbre de la guitarra y trémolo. En el Castillo, además, más
// grave, más rápido y siempre tenso.
import type { MusicVariant } from './music';

const BOSS_MUSIC: Record<string, MusicVariant> = {
  drifter: {},
  wall: { transpose: -5, bpm: 60, voice: 'sawtooth', tremolo: 4 },
  duelist: { transpose: 2, bpm: 84, tremolo: 7 },
  trickster: { transpose: 3, bpm: 76, chance: 0.55 },
  thief: { transpose: 1, bpm: 88, chance: 0.3 },
  matriarch: { transpose: -3, bpm: 62, voice: 'sine' },
  mirrorist: { transpose: 7, bpm: 72, voice: 'sine', tremolo: 8 },
  poisoner: { transpose: -1, bpm: 66, voice: 'square', tremolo: 3 },
  bard: { transpose: 5, bpm: 80, chance: 0.6 },
  sailor: { transpose: -7, bpm: 64, tremolo: 3 },
  seer: { transpose: 4, bpm: 58, voice: 'sine', chance: 0.35 },
  sovereign: { transpose: -2, bpm: 74, voice: 'sawtooth', chance: 0.5 },
};

export const bossMusic = (bossId: string, castle: boolean): MusicVariant & { key: string } => {
  const v = BOSS_MUSIC[bossId] ?? {};
  if (!castle) return { ...v, key: bossId };
  return { ...v, key: `castle:${bossId}`, transpose: (v.transpose ?? 0) - 1, bpm: (v.bpm ?? 70) + 8, heat: 0.35 };
};
