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
export const LAMP = s(
  '...oooo...',
  '..onnnno..',
  '.onnnnnno.',
  '.ocwccbco.',
  '.owccccbo.',
  '.ocbbbbbo.',
  '.onnnnnno.',
  '..oonnoo..',
  '....on....',
  '...onno...',
  '...onno...',
  '...onno...',
  '...onno...',
  '...onno...',
  '...onno...',
  '...onno...',
  '...onno...',
  '...onno...',
  '...onno...',
  '...onno...',
  '...onno...',
  '...onno...',
  '..onnnno..',
  '.oddddddo.',
  '.ooooooooo',
);

/** Banderola con mástil; la tela usa el color del bando */
export const BANNER = s(
  '.oo.........',
  'oyyo........',
  'oYYoooooooo.',
  '.on.otTTTtuo',
  '.on.otTTTtuo',
  '.on.otTTTtuo',
  '.on.otTTTtuo',
  '.on.otTTTtuo',
  '.on.otTTTtuo',
  '.on.otTTTtuo',
  '.on.otTTTtuo',
  '.on.otTTTtuo',
  '.on.otTTTtuo',
  '.on.otTTttuo',
  '.on.ottouttuo',
  '.on.otuo.ouo',
  '.on.ouo...oo',
  '.on.oo......',
  '.on.........',
  '.on.........',
  '.on.........',
  '.on.........',
  '.on.........',
  'onno........',
  'oooo........',
);

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

// --- PERSONAJES CHIBI (16×22) ---
// Visten el color de su bando (t/T/u).

/** K — El Rey: corona, barba blanca, manto */
const KING = s(
  '....o..oo..o....',
  '...oyo.oyyo.oyo.',
  '...oyyyyyyyyyyo.',
  '...oYcYYYYYYcYo.',
  '..osssssssssssso',
  '..osssssssssssso',
  '..ossnssssssnsso',
  '..ossnssssssnsso',
  '..oSswwwwwwwwsSo',
  '..owwwwwwwwwwwwo',
  '...owwwwwwwwwwo.',
  '....owwwwwwwwo..',
  '...otTwwwwwwTto.',
  '..otTTtwwwwtTTto',
  '..otTtttyytttTto',
  '..osTtttyytttTso',
  '..otTTttyyttTtuo',
  '..otTTtttttttuuo',
  '..otTtttttttuuuo',
  '..ouuuuuuuuuuuuo',
  '...oooo....oooo.',
  '...oMMo....oMMo.',
);

/** Q — La Reina: tiara, melena, vestido */
const QUEEN = s(
  '.......o..o.....',
  '......oyooyo....',
  '.....oyyccyyo...',
  '...ommmmmmmmmmo.',
  '..ommmmmmmmmmmmo',
  '..ommssssssssmmo',
  '..omsnssssssnsmo',
  '..omsnssssssnsmo',
  '..omSsssxxsssSmo',
  '..ommssssssssmmo',
  '..ommmssssssmmmo',
  '...ommottttommo.',
  '...omotTTTTtomo.',
  '....otTwwTTto...',
  '...otTTyyTTTto..',
  '..ostTTTTTTTtso.',
  '..otTTTTTTTTTto.',
  '.otTTTTTTTTTTtto',
  '.otTTTTTTTTTtuuo',
  '.ouuuuuuuuuuuuuo',
  '..ooooooooooooo.',
);

/** J — El Príncipe: gorro con pluma, túnica */
const JACK = s(
  '..........oo....',
  '.........oyyo...',
  '....oooooooyo...',
  '...otTTTTTTTTo..',
  '..otTTTTTTTTTuo.',
  '..ouuuuuuuuuuuo.',
  '..ommmmmmmmmmmmo',
  '..omssssssssssmo',
  '..osnssssssssnso',
  '..osnssssssssnso',
  '..oSsssssxxsssSo',
  '...osssssssssso.',
  '....oooossoooo..',
  '...otTTwwwwTTto.',
  '..otTTTTyyTTTTto',
  '..osTTTTyyTTTTso',
  '..otTTTTTTTTTTuo',
  '...ouuuuuuuuuuo.',
  '....onnno.onnno.',
  '....onnno.onnno.',
  '...oMMMMo.oMMMMo',
  '...ooooo...oooo.',
);

/** A — El Sabio: capucha y bastón con orbe que limpia el tablero */
const ACE = s(
  '............oo..',
  '......o....ocwo.',
  '.....ono...occo.',
  '....onnno...oo..',
  '...onnnnno..om..',
  '..onnnnnnno.om..',
  '..onnnnnnnnoom..',
  '..onnsssssnnosmo',
  '..onssnsnssnosmo',
  '..onssnsnssnnomo',
  '..onsssssssnnom.',
  '...onnwwwnnnoom.',
  '...onnnwnnnnnom.',
  '..onnnnnnnnnnom.',
  '..onncnnnnnnnom.',
  '.onnncnnnnnnnom.',
  '.onnnnnnnnnnnnom',
  '.onccccccccccnom',
  '.onnnnnnnnnnnnom',
  '..oooooooooooo.o',
  '..............MM',
);

/** Joker — El Bufón: gorro de dos puntas con cascabeles */
const JOKER = s(
  '.oo..........oo.',
  'oyyo........oyyo',
  '.oyo........oto.',
  '..otto....oyyo..',
  '...ottoooyyyo...',
  '...otttttyyyo...',
  '..otttttyyyyyo..',
  '..owwwwwwwwwwwo.',
  '..ossssssssssso.',
  '..ossnssssnssso.',
  '..oxsnssssnsxso.',
  '..osssoooooosso.',
  '...ossowwwosso..',
  '....oossssoo....',
  '...owtywtywtyo..',
  '..otttttyyyyyyo.',
  '..osttttyyyyyso.',
  '..otttttyyyyyyo.',
  '...ouuuuYYYYYo..',
  '...onno..onno...',
  '...oooo..oooo...',
);

export const CHARACTERS: Partial<Record<Rank, Sprite>> = {
  K: KING,
  Q: QUEEN,
  J: JACK,
  A: ACE,
  JOKER: JOKER,
};
