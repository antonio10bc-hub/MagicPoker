import { SceneryId } from '@/components/pixel/scenery';
import { Biome } from './MapTerrain';

// --- PARADAS DEL CAMINO ---
// Cada jefe espera en un sitio que cuenta quién es. Las posiciones son relativas a sus
// pies: `dx` hacia fuera del camino (en las paradas de la izquierda se refleja todo) y
// `dy` hasta la base del decorado (`front`: los que quedan por delante, más abajo que
// sus pies). El jefe y su nombre siempre se ven encima. `anim`: humo que sube, notas
// que flotan, llamas, destellos.

export interface StationProp {
  id: SceneryId;
  dx: number;
  dy: number;
  /** Por delante del jefe (solo informativo: se coloca con `dy`) */
  front?: boolean;
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
  // El Forastero: cruce de caminos con poste indicador y una hoguera
  drifter: { props: [
    { id: 'signpost', dx: 30, dy: -4 },
    { id: 'rock', dx: 46, dy: -2 },
    { id: 'campfire', dx: -30, dy: 10, front: true, anim: 'flicker' },
    { id: 'bush', dx: 50, dy: 12, front: true },
  ] },
  // El Muro: un fortín de piedra con antorchas
  wall: { props: [
    { id: 'fort', dx: 30, dy: -10 },
    { id: 'torch', dx: -22, dy: 4, anim: 'flicker' },
    { id: 'rock', dx: 54, dy: 12, front: true },
  ] },
  // La Duelista: palenque de estacas, espadas clavadas y banderolas
  duelist: { props: [
    { id: 'stakes', dx: 22, dy: -12 },
    { id: 'pennant', dx: -26, dy: -2 },
    { id: 'pennant', dx: 54, dy: -6 },
    { id: 'swords', dx: 42, dy: 12, front: true },
  ] },
  // El Trilero: carpa de feria a rayas y la mesa de los cubiletes
  trickster: { props: [
    { id: 'tent', dx: 34, dy: -10, anim: 'flicker' },
    { id: 'cups', dx: -32, dy: 10, front: true },
  ] },
  // La Ladrona: guarida con el carro y el botín (sacos, cofre de oro, monedas)
  thief: { props: [
    { id: 'cart', dx: 34, dy: -12 },
    { id: 'loot', dx: 44, dy: 14, front: true, anim: 'twinkle' },
    { id: 'bush', dx: -30, dy: 4 },
  ] },
  // La Matriarca: casa de campo con humo, huerto y pozo
  matriarch: {
    props: [
      { id: 'cottage', dx: 32, dy: -12 },
      { id: 'smoke', dx: 32 + 7, dy: -44, anim: 'smoke' },
      { id: 'well', dx: -30, dy: 4 },
      { id: 'fence', dx: 54, dy: 14, front: true },
    ],
    biome: { kind: 'field', dx: 46, dy: 22, rx: 34, ry: 12 },
  },
  // El Espejista: estanque quieto y espejos de pie
  mirrorist: { props: [
    { id: 'mirror', dx: 30, dy: -8, anim: 'twinkle' },
    { id: 'mirror', dx: -28, dy: -4, flip: true },
    { id: 'pond', dx: 40, dy: 22, front: true },
    { id: 'reeds', dx: 62, dy: 16, front: true },
  ] },
  // La Tóxica: ciénaga, árboles muertos y un caldero que burbujea
  poisoner: {
    props: [
      { id: 'dead_tree', dx: 44, dy: -14 },
      { id: 'dead_tree', dx: -40, dy: -10, flip: true },
      { id: 'cauldron', dx: 32, dy: 8, front: true, anim: 'flicker' },
      { id: 'skull', dx: -26, dy: 12, front: true },
    ],
    biome: { kind: 'swamp', dx: 36, dy: 16, rx: 52, ry: 16 },
  },
  // El Bardo: taberna con ventanas encendidas, barriles y música en el aire
  bard: { props: [
    { id: 'tavern', dx: 32, dy: -12, anim: 'flicker' },
    { id: 'notes', dx: 12, dy: -52, anim: 'float' },
    { id: 'barrels', dx: -30, dy: 8, front: true },
  ] },
  // El Marinero: muelle con su barca sobre el mar, y un ancla
  sailor: {
    props: [
      { id: 'harbor', dx: 46, dy: 18 },
      { id: 'anchor', dx: -28, dy: 10, front: true },
    ],
    biome: { kind: 'water', dx: 66, dy: 10, rx: 66, ry: 26 },
  },
  // La Vidente: torre con un ojo encendido, menhires y chispas en el cielo
  seer: { props: [
    { id: 'seer_tower', dx: 34, dy: -8, anim: 'flicker' },
    { id: 'sparks', dx: 24, dy: -56, anim: 'twinkle' },
    { id: 'menhir_l', dx: -24, dy: -6 },
    { id: 'menhir_s', dx: -36, dy: 2 },
    { id: 'menhir_s', dx: 56, dy: 12, front: true },
  ] },
  // El Soberano: la puerta real con estandartes de oro y braseros
  sovereign: { props: [
    { id: 'royal_gate', dx: 0, dy: -2 },
    { id: 'brazier', dx: -34, dy: 10, front: true, anim: 'flicker' },
    { id: 'brazier', dx: 34, dy: 10, front: true, anim: 'flicker' },
  ] },
};
