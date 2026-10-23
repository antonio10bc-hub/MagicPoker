import { SceneryId } from '@/components/pixel/scenery';
import { Biome } from './MapTerrain';

// --- PUEBLOS DEL CAMINO ---
// Cada jefe espera en su pueblo, que cuenta quién es: casas y lugares de su oficio a
// los dos lados del camino. Las posiciones son relativas a sus
// pies: `dx` hacia fuera del camino (en las paradas de la izquierda se refleja todo) y
// `dy` hasta la base del decorado (se pintan de atrás adelante). El jefe y su nombre
// siempre se ven encima. `anim`: humo que sube, notas
// que flotan, llamas, destellos.

export interface StationProp {
  id: SceneryId;
  dx: number;
  dy: number;
  /** Reflejarlo además del lado */
  flip?: boolean;
  anim?: 'smoke' | 'float' | 'flicker' | 'twinkle';
}

export interface Station {
  props: StationProp[];
  /** Terreno especial alrededor (relativo como los decorados) */
  biome?: Omit<Biome, 'x' | 'y'> & { dx: number; dy: number };
}

export const STATIONS: Record<string, Station> = {
  // El Forastero: un campamento en el cruce de caminos (chozas, tiendas, caballo, carro y hoguera)
  drifter: {
    props: [
      { id: 'hut', dx: 46, dy: -24 },
      { id: 'tent_small', dx: -46, dy: -16 },
      { id: 'tent_small', dx: -72, dy: -6 },
      { id: 'haystack', dx: 66, dy: -10 },
      { id: 'signpost', dx: 20, dy: -2 },
      { id: 'horse', dx: 44, dy: 12 },
      { id: 'cart', dx: -56, dy: 22 },
      { id: 'campfire', dx: -28, dy: 12, anim: 'flicker' },
    ],
  },
  // El Muro: un bastión amurallado (murallas, torre de guardia, fortín, escudos y antorchas)
  wall: {
    props: [
      { id: 'house_a', dx: -60, dy: -34 },
      { id: 'house_c', dx: -88, dy: -32 },
      { id: 'wall_seg', dx: -48, dy: -22 },
      { id: 'wall_seg', dx: -88, dy: -22 },
      { id: 'watchtower', dx: -24, dy: -18 },
      { id: 'fort', dx: 44, dy: -14 },
      { id: 'torch', dx: -14, dy: 6, anim: 'flicker' },
      { id: 'shield_banner', dx: 22, dy: 16 },
      { id: 'shield_banner', dx: -64, dy: 16 },
    ],
  },
  // La Duelista: el campo del torneo (gradas, pabellón, banderolas, muñeco y armero)
  duelist: {
    props: [
      { id: 'stands', dx: -58, dy: -22 },
      { id: 'pavilion', dx: 42, dy: -18 },
      { id: 'pennant', dx: 70, dy: -6 },
      { id: 'pennant', dx: -92, dy: 0 },
      { id: 'dummy', dx: -26, dy: 12 },
      { id: 'weapon_rack', dx: 60, dy: 14 },
      { id: 'swords', dx: 30, dy: 18 },
    ],
  },
  // El Trilero: la feria (carpa grande, tiovivo, guirnalda de farolillos, puestos y cubiletes)
  trickster: {
    props: [
      { id: 'lantern_string', dx: 0, dy: -50, anim: 'twinkle' },
      { id: 'tent', dx: -54, dy: -14, anim: 'flicker' },
      { id: 'carousel', dx: 44, dy: -14, anim: 'twinkle' },
      { id: 'stall', dx: -34, dy: 20 },
      { id: 'cups', dx: 28, dy: 14 },
      { id: 'stall', dx: 64, dy: 20, flip: true },
    ],
  },
  // La Ladrona: el arrabal de los ladrones (cueva, chabolas, cartel de se busca, cajas y botín)
  thief: {
    props: [
      { id: 'cave', dx: -58, dy: -20, anim: 'flicker' },
      { id: 'shack', dx: 42, dy: -16 },
      { id: 'shack', dx: -96, dy: -2, flip: true },
      { id: 'wanted', dx: 20, dy: -4 },
      { id: 'crates', dx: -74, dy: 22 },
      { id: 'cart', dx: -36, dy: 22, flip: true },
      { id: 'loot', dx: 46, dy: 20, anim: 'twinkle' },
    ],
  },
  // La Matriarca: la aldea de labranza (molino, casas, pozo, pajar, valla y huerto)
  matriarch: {
    props: [
      { id: 'windmill', dx: -58, dy: -26 },
      { id: 'house_b', dx: 66, dy: -28 },
      { id: 'cottage', dx: 38, dy: -12 },
      { id: 'smoke', dx: 45, dy: -44, anim: 'smoke' },
      { id: 'house_c', dx: -90, dy: -10 },
      { id: 'well', dx: -28, dy: 12 },
      { id: 'haystack', dx: 60, dy: 16 },
      { id: 'fence', dx: -62, dy: 22 },
    ],
    biome: { kind: 'field', dx: -50, dy: 26, rx: 40, ry: 10 },
  },
  // El Espejista: el pueblo del lago (palafitos, espejos de pie, cristal y juncos)
  mirrorist: {
    props: [
      { id: 'crystal', dx: -72, dy: -22, anim: 'twinkle' },
      { id: 'mirror', dx: 24, dy: -12, anim: 'twinkle' },
      { id: 'mirror', dx: -26, dy: -8, flip: true },
      { id: 'stilt', dx: 50, dy: 6 },
      { id: 'stilt_s', dx: -52, dy: 8 },
      { id: 'reeds', dx: 72, dy: 22 },
    ],
    biome: { kind: 'water', dx: 0, dy: 20, rx: 92, ry: 14 },
  },
  // La Tóxica: la ciénaga (palafito, árboles muertos, secadero de hierbas, caldero y setas)
  poisoner: {
    props: [
      { id: 'dead_tree', dx: 70, dy: -22 },
      { id: 'dead_tree', dx: -84, dy: -18, flip: true },
      { id: 'drying_rack', dx: 36, dy: -16 },
      { id: 'stilt_s', dx: -56, dy: 0 },
      { id: 'cauldron', dx: -28, dy: 12, anim: 'flicker' },
      { id: 'mushrooms', dx: 26, dy: 18, anim: 'twinkle' },
      { id: 'mushrooms', dx: -64, dy: 24, flip: true, anim: 'twinkle' },
      { id: 'skull', dx: -42, dy: 22 },
    ],
    biome: { kind: 'swamp', dx: 0, dy: 18, rx: 92, ry: 16 },
  },
  // El Bardo: la villa de la taberna (taberna, posada, quiosco de música, farolas y barriles)
  bard: {
    props: [
      { id: 'house_c', dx: -94, dy: -24 },
      { id: 'tavern', dx: -50, dy: -14, anim: 'flicker' },
      { id: 'inn', dx: 48, dy: -20, anim: 'flicker' },
      { id: 'notes', dx: -34, dy: -58, anim: 'float' },
      { id: 'lamp', dx: 18, dy: 0 },
      { id: 'lamp', dx: -20, dy: 4 },
      { id: 'barrels', dx: 30, dy: 14 },
      { id: 'bandstand', dx: -60, dy: 26 },
    ],
  },
  // El Marinero: el puerto (casas, faro, muelle con barca, redes, cajas y ancla)
  sailor: {
    props: [
      { id: 'house_b', dx: -66, dy: -20 },
      { id: 'house_a', dx: -34, dy: -26 },
      { id: 'lighthouse', dx: 72, dy: -18, anim: 'flicker' },
      { id: 'harbor', dx: 52, dy: 22 },
      { id: 'crates', dx: -30, dy: 14 },
      { id: 'nets', dx: -62, dy: 16 },
      { id: 'anchor', dx: 20, dy: 14 },
    ],
    biome: { kind: 'water', dx: 78, dy: 14, rx: 64, ry: 46 },
  },
  // La Vidente: el santuario (torre del ojo, templo, menhires, cristal y chispas)
  seer: {
    props: [
      { id: 'sparks', dx: -24, dy: -72, anim: 'twinkle' },
      { id: 'seer_tower', dx: -48, dy: -12, anim: 'flicker' },
      { id: 'temple', dx: 46, dy: -14, anim: 'flicker' },
      { id: 'menhir_l', dx: 26, dy: 4 },
      { id: 'menhir_s', dx: -22, dy: 10 },
      { id: 'menhir_l', dx: -80, dy: 18 },
      { id: 'menhir_s', dx: 66, dy: 18 },
      { id: 'crystal', dx: 72, dy: -2, anim: 'twinkle' },
    ],
  },
  // El Soberano: la ciudad real (palacio, murallas, puerta real, estandartes de oro y braseros)
  sovereign: {
    props: [
      { id: 'house_d', dx: -84, dy: -24 },
      { id: 'house_d', dx: 84, dy: -24, flip: true },
      { id: 'palace', dx: 0, dy: -36 },
      { id: 'wall_seg', dx: -58, dy: -8 },
      { id: 'wall_seg', dx: 58, dy: -8 },
      { id: 'royal_gate', dx: 0, dy: -2 },
      { id: 'gold_banner', dx: -36, dy: 10 },
      { id: 'gold_banner', dx: 36, dy: 10, flip: true },
      { id: 'brazier', dx: -22, dy: 16, anim: 'flicker' },
      { id: 'brazier', dx: 22, dy: 16, anim: 'flicker' },
    ],
  },
};
