// --- LA MÚSICA DEL BOSQUE Y DE SUS REINOS ---
// El mismo motor (lib/music.ts) con un carácter muy distinto en cada bosque, para que se
// note dónde estás:
//  · El Bosque: nocturno y quieto (el tema del menú, más lento y grave, con viento).
//  · Pesadillas: opresiva. Muy grave y lenta, la segunda menor disonante siempre sonando,
//    guitarra áspera con trémolo nervioso y un latido de fondo.
//  · Únicos: solemne, de corte. Re lidio (la única luminosa), campanas y paso procesional.
//  · Renegados: fría y desolada. Escala de tonos enteros, notas sueltas de seno con eco
//    largo, sin pulso, viento.
// En los duelos de un reino suena su variante (con su pelea y su tensión); en el Bosque
// de siempre, la del jefe que más se parece al rival.
import type { Realm } from './forest';
import type { MusicVariant } from './music';

type View = Realm | 'main';

const AMBIENT: Record<View, MusicVariant> = {
  main: { transpose: -2, bpm: 50, chance: 0.22, wind: 0.03, droneLevel: 1.1 },
  nightmare: { transpose: -7, bpm: 44, chance: 0.3, voice: 'sawtooth', tremolo: 9, heat: 0.55, heartbeat: true, droneLevel: 1.5, wind: 0.025 },
  unique: {
    bpm: 62, chance: 0.42, bell: true, pulse: true, pulseEvery: 2,
    scale: [62, 64, 66, 68, 69, 71, 73, 74, 76, 78, 81], roots: [50, 57, 59, 55],
  },
  renegade: {
    bpm: 52, chance: 0.14, voice: 'sine', tremolo: 2, echo: { time: 0.55, feedback: 0.55 }, wind: 0.06, droneLevel: 0.8,
    scale: [52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72], roots: [40, 42, 38, 44],
  },
};

/** El ambiente de un bosque (en su pantalla) */
export const forestAmbient = (view: View): MusicVariant & { key: string } => ({ ...AMBIENT[view], key: `forest:${view}` });

/** El duelo dentro de un reino: su variante, algo más viva y con pulso */
export const realmDuel = (realm: Realm): MusicVariant & { key: string } => {
  const v = AMBIENT[realm];
  return { ...v, key: `duel:${realm}`, bpm: (v.bpm ?? 60) + 8, pulse: true, wind: 0 };
};
