import { Rank } from '@/types';
import { Sprite } from './PixelSprite';

// --- SPRITES ORIGINALES ---
// Leyenda (ver PixelSprite): o contorno · w blanco · n navy · b cristal · c cian
// d piedra oscura · g suelo · l patrón · p pavimento · y/Y amarillo · m/M madera
// s/S piel · x/X rojo · t/T/u color del bando (base/brillo/sombra) · '.' transparente
// Luz siempre desde arriba-izquierda: brillos arriba/izquierda, sombras abajo/derecha.

const s = (...rows: string[]): Sprite => ({ rows });

// --- ICONOS DE INTERFAZ (9×9, navy) ---
export const ICONS = {
  home: s(
    '....n....',
    '...nnn...',
    '..nnnnn..',
    '.nnnnnnn.',
    'nnnnnnnnn',
    '.nnnnnnn.',
    '.nnn.nnn.',
    '.nnn.nnn.',
    '.nnn.nnn.',
  ),
  info: s(
    '...nnn...',
    '...nnn...',
    '.........',
    '..nnnn...',
    '...nnn...',
    '...nnn...',
    '...nnn...',
    '...nnn...',
    '..nnnnn..',
  ),
  trophy: s(
    'nnnnnnnnn',
    'n.nnnnn.n',
    'n.nnnnn.n',
    '.nnnnnnn.',
    '..nnnnn..',
    '....n....',
    '....n....',
    '..nnnnn..',
    '.nnnnnnn.',
  ),
  soundOn: s(
    '...n.....',
    '..nn..n..',
    'nnnn...n.',
    'nnnn.n.n.',
    'nnnn.n.n.',
    'nnnn...n.',
    '..nn..n..',
    '...n.....',
  ),
  soundOff: s(
    '...n.....',
    '..nn.....',
    'nnnn.n.n.',
    'nnnn..n..',
    'nnnn..n..',
    'nnnn.n.n.',
    '..nn.....',
    '...n.....',
  ),
  gear: s(
    '...n.n...',
    '.nnnnnnn.',
    '.nn...nn.',
    'nn.....nn',
    '.n..n..n.',
    'nn.....nn',
    '.nn...nn.',
    '.nnnnnnn.',
    '...n.n...',
  ),
  close: s(
    'nn...nn',
    'nnn.nnn',
    '.nnnnn.',
    '..nnn..',
    '.nnnnn.',
    'nnn.nnn',
    'nn...nn',
  ),
  cursor: s(
    'ooooooo',
    'oyyyyyo',
    '.oyyyo.',
    '..oyo..',
    '...o...',
  ),
};

// --- AVISOS DEL TABLERO ---
/** Mira: hueco rival al que apuntan tus cartas */
export const TARGET = s(
  '....o....',
  '..ooyoo..',
  '.oy.y.yo.',
  '.o..y..o.',
  'oyyywyyyo',
  '.o..y..o.',
  '.oy.y.yo.',
  '..ooyoo..',
  '....o....',
);

/** ✓ (sobre fondo verde) */
export const CHECK = s(
  '......w',
  '.....ww',
  'w...ww.',
  'ww.ww..',
  '.www...',
  '..w....',
);

/** ✗ (sobre fondo rojo) */
export const CROSS = s(
  'ww...ww',
  '.ww.ww.',
  '..www..',
  '.ww.ww.',
  'ww...ww',
);

/** ! (sobre fondo rojo) */
export const ALERT = s(
  'ww',
  'ww',
  'ww',
  'ww',
  '..',
  'ww',
);

// --- VIDAS (9×8) ---
export const HEART = s(
  '.oo...oo.',
  'oxwxoxxxo',
  'oxwxxxxxo',
  'oxxxxxxXo',
  '.oxxxxXo.',
  '..oxxXo..',
  '...oXo...',
  '....o....',
);

export const HEART_LOST = s(
  '.oo...oo.',
  'oglgoggdo',
  'oggogggdo',
  'ogggoggdo',
  '.oggodgo.',
  '..oodgo..',
  '...odo...',
  '....o....',
);

// --- EMBLEMAS DE BANDO (7×7) ---
/** Jugador: rombo con brote */
export const EMBLEM_PLAYER = s(
  '...o...',
  '..owo..',
  '.owTwo.',
  'owTwTwo',
  '.otTto.',
  '..oto..',
  '...o...',
);

/** Rival: llama */
export const EMBLEM_OPPONENT = s(
  '...o...',
  '..owo..',
  '..owTo.',
  '.owTTo.',
  'owTwTto',
  'otTTtuo',
  '.ooooo.',
);

// --- PIPS DE LAS CARTAS NUMÉRICAS (5×5) ---
export const PIP = s(
  '..o..',
  '.oTo.',
  'oTwto',
  '.oto.',
  '..o..',
);

// --- ESCENARIO ---
/** Estallido de impacto (13×13) */
export const BURST = s(
  '......o......',
  '.....owo.....',
  '.o..owywo..o.',
  '.owoywyywowo.',
  '..owyyyyywo..',
  '.oyyywwwyyyo.',
  'owyywwwwwyywo',
  '.oyyywwwyyyo.',
  '..owyyyyywo..',
  '.owoywyywowo.',
  '.o..owywo..o.',
  '.....owo.....',
  '......o......',
);

/** Estrella (insignia del As) 7×7 */
export const STAR = s(
  '...o...',
  '..oyo..',
  'ooywyoo',
  'oyyyyyo',
  '.oyyyo.',
  '.oyoyo.',
  '.oo.oo.',
);

// --- PERSONAJES CHIBI (18×24) ---
// Visten el color de su bando (t/T/u). Ojos con brillo (w), rubor (x) y dos tonos de sombra.

/** K — El Rey: corona con gemas, barba blanca, manto con ribete dorado */
const KING = s(
  '....o...oo...o....',
  '...oyo.oyyo.oyo...',
  '...oyyyyyyyyyyo...',
  '...oYcYYxxYYcYo...',
  '..owwwwwwwwwwwwo..',
  '..owsssssssssswo..',
  '..osssssssssssso..',
  '..ossnwssssnwsso..',
  '..ossnnssssnnsso..',
  '..oxswwwwwwwwsxo..',
  '..owwwwSwwSwwwwo..',
  '...owwwwwwwwwwo...',
  '....oowwwwwwoo....',
  '...owwwwyywwwwo...',
  '..otTTtyyyytTTto..',
  '..otTTttyyttTTto..',
  '..osTTttyyttTTso..',
  '..otTTttttttTtuo..',
  '..otTtttttttuuuo..',
  '..oyTttttttttuyo..',
  '..oyyyyyyyyyyyyo..',
  '...oooooooooooo...',
  '....oMMo..oMMo....',
  '....oooo..oooo....',
);

/** Q — La Reina: tiara, melena, rubor y vestido largo */
const QUEEN = s(
  '.......o..o.......',
  '......oyooyo......',
  '.....oyyccyyo.....',
  '...ommmmmmmmmmo...',
  '..ommmmmmmmmmmmo..',
  '..ommssssssssmmo..',
  '..omssssssssssmo..',
  '..omsnwssssnwsmo..',
  '..omsnnssssnnsmo..',
  '..omxssssssssxmo..',
  '..ommsssxxsssmmo..',
  '..ommmossssommmo..',
  '..omm.oottoo.mmo..',
  '..om.otTwwTto.mo..',
  '...ootTTyyTTtoo...',
  '...osTTTyyTTTso...',
  '...otTTTTTTTTto...',
  '..otTTTTTTTTTTto..',
  '..otTTTTTTTTTtuo..',
  '.otTTTTTTTTTTtuuo.',
  '.otTTTTTTTTTtuuuo.',
  '.ouuuuuuuuuuuuuuo.',
  '..oooooooooooooo..',
);

/** J — El Príncipe: gorro con pluma, túnica con cinturón y botas */
const JACK = s(
  '............oo....',
  '...........oyyo...',
  '......ooooooyo....',
  '.....otTTTTTTo....',
  '....otTTTTTTTTo...',
  '...otTTTTTTTTTuo..',
  '..ouuuuuuuuuuuuo..',
  '..ommmmmmmmmmmmo..',
  '..omsnwssssnwsmo..',
  '..omsnnssssnnsmo..',
  '..osxssssssssxso..',
  '...osssssxsssso...',
  '....oossssssoo....',
  '...otTwwwwwwTto...',
  '..otTTTTyyTTTTto..',
  '..osTTTTyyTTTTso..',
  '..otTTTTyyTTTTuo..',
  '...ouuuuyyuuuuo...',
  '....onno..onno....',
  '....onno..onno....',
  '...oMMMo..oMMMo...',
  '...ooooo..ooooo...',
);

/** A — El Sabio: capucha, ojos que brillan y bastón con orbe que limpia el tablero */
const ACE = s(
  '..............oo..',
  '.......o.....occo.',
  '......ono...ocwco.',
  '.....onnno...occo.',
  '....onnnnno...oo..',
  '...onnnnnnno...omo',
  '..onnnnnnnnno..omo',
  '..onnssssssnno.omo',
  '..onscsssscsno.omo',
  '..onssssssssno.omo',
  '..onnswwwwsnno.omo',
  '...onnwwwwnno..oso',
  '...onnncnnnno..omo',
  '..onnnncnnnnno.omo',
  '..onnnnncnnnno.omo',
  '.onnnnnnnnnnnnoomo',
  '.occccccccccccoomo',
  '.onnnnnnnnnnnnoomo',
  '..oooooooooooo..M.',
);

/** Joker — El Bufón: gorro de dos puntas con cascabeles, sonrisa y traje partido */
const JOKER = s(
  '.oo............oo.',
  'oyyo..........oyyo',
  '.oto..........oyo.',
  '..otto......oyyo..',
  '...ottoo..ooyyo...',
  '....otttooyyyo....',
  '...otttttyyyyyo...',
  '..owywywywywywyo..',
  '..osssssssssssso..',
  '..ossnwssssnwsso..',
  '..ossnnssssnnsso..',
  '..oxssssssssssxo..',
  '..osssowwwwossso..',
  '...ossoowwoosso...',
  '....oossssssoo....',
  '..owtywtywtywtyo..',
  '..ottttttyyyyyyo..',
  '..ostttttyyyyyso..',
  '..ottttttyyyyyyo..',
  '...ouuuuuYYYYYo...',
  '...otto....oyyo...',
  '..oyyyo....ottto..',
  '..ooooo....ooooo..',
);

export const CHARACTERS: Partial<Record<Rank, Sprite>> = {
  K: KING,
  Q: QUEEN,
  J: JACK,
  A: ACE,
  JOKER: JOKER,
};
