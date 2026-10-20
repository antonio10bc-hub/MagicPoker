import { Rank, SealId } from '@/types';
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

// --- SELLOS (9×9): se pintan en verde eléctrico ---
export const SEAL_ICONS: Record<SealId, Sprite> = {
  /** Defensa: escudo */
  shield: s(
    'ooooooooo',
    'ooo...ooo',
    'ooooooooo',
    'ooooooooo',
    '.ooooooo.',
    '.ooooooo.',
    '..ooooo..',
    '...ooo...',
    '....o....',
  ),
  /** Ataque doble: dos flechas */
  double: s(
    '..o...o..',
    '.ooo.ooo.',
    'ooooooooo',
    '..o...o..',
    '..o...o..',
    '..o...o..',
    '..o...o..',
    '..o...o..',
    '..o...o..',
  ),
  /** Cambio: flecha hacia la derecha */
  shift: s(
    '.........',
    '....o....',
    '....oo...',
    'ooooooo..',
    'oooooooo.',
    'ooooooo..',
    '....oo...',
    '....o....',
    '.........',
  ),
  /** Cambio con enemigo: flechas arriba y abajo */
  swap: s(
    '..o......',
    '.ooo.....',
    'ooooo....',
    '..o...o..',
    '..o...o..',
    '..o...o..',
    '....ooooo',
    '.....ooo.',
    '......o..',
  ),
  /** Vida: corazón */
  life: s(
    '.oo...oo.',
    'oooo.oooo',
    'ooooooooo',
    'ooooooooo',
    'ooooooooo',
    '.ooooooo.',
    '..ooooo..',
    '...ooo...',
    '....o....',
  ),
};

// --- PERSONAJES (19×23, se dibujan como siluetas: cuenta el contorno, no el detalle) ---
/** K — El Rey: corona de tres puntas, barba, capa ancha y cetro */
const KING = s(
  '....o...o...o......',
  '....oo.ooo.oo......',
  '....ooooooooo......',
  '....ooooooooo....o.',
  '.....o.ooo.o....ooo',
  '.....ooooooo.....o.',
  '....ooooooooo....o.',
  '....ooooooooo....o.',
  '.....ooooooo....oo.',
  '..ooooooooooooo.oo.',
  '.oooooooooooooooo..',
  'oooooooooooooooooo.',
  'ooo.oooooooooo.oo..',
  'oo..oooooooooo..o..',
  'o...oooooooooo.....',
  '....oooooooooo.....',
  '....oooooooooo.....',
  '....oooooooooo.....',
  '...oooooooooooo....',
  '..oooooooooooooo...',
  '.oooooooooooooooo..',
  'oooooooooooooooooo.',
  'oooooooooooooooooo.',
);

/** Q — La Reina: tiara alta, melena, cintura fina y vestido de campana con abanico */
const QUEEN = s(
  '........o.........',
  '.......ooo........',
  '.....o.ooo.o......',
  '.....ooooooo......',
  '.....ooooooo......',
  '....oo.ooo.oo.....',
  '...ooo.ooo.ooo....',
  '...ooooooooooo....',
  '...ooo.ooo.ooo....',
  '...oooo...oooo....',
  '....ooooooo.......',
  '.....ooooo.....o..',
  '....ooooooo...ooo.',
  '...ooooooooo.ooooo',
  '...oooooo.oooo.oo.',
  '....ooooooo.......',
  '.....ooooo........',
  '....ooooooo.......',
  '...ooooooooo......',
  '..ooooooooooo.....',
  '.ooooooooooooo....',
  'oooooooooooooooo..',
  'oooooooooooooooooo',
);

/** J — El Príncipe: gorro con pluma, capa corta y espada en alto */
const JACK = s(
  '..............o...',
  '.............oo...',
  '............oo....',
  '....ooooooo.o.....',
  '...oooooooooo.....',
  '..oooooooooooo....',
  '.....oooooo.......',
  '.....o.oo.o.......',
  '.....oooooo.......',
  '......oooo.....o..',
  '....oooooooo..oo..',
  '...oooooooooo.o...',
  '..oooooooooooo....',
  '..oo.oooooo.oo....',
  '..o..oooooo..o....',
  '.....oooooo.......',
  '.....oooooo.......',
  '.....oo..oo.......',
  '.....oo..oo.......',
  '.....oo..oo.......',
  '.....oo..oo.......',
  '....ooo..ooo......',
  '...oooo..oooo.....',
);

/** A — El Sabio: capucha puntiaguda, túnica y bastón con orbe */
const ACE = s(
  '........o.........',
  '.......ooo.....oo.',
  '......ooooo...oooo',
  '.....ooooooo..oooo',
  '....ooo.o.ooo..oo.',
  '....ooooooooo..o..',
  '....oo.....oo..o..',
  '.....oo...oo...o..',
  '....ooooooooo..o..',
  '...ooooooooooo.o..',
  '..ooooooooooooo...',
  '..ooooooooooooo...',
  '..oo.ooooooo.ooo..',
  '..oo.ooooooo..o...',
  '..o..ooooooo..o...',
  '.....ooooooo..o...',
  '....ooooooooo.o...',
  '....ooooooooo.o...',
  '...ooooooooooo....',
  '...ooooooooooo....',
  '..ooooooooooooo...',
  '.ooooooooooooooo..',
);

/** Joker — El Bufón: gorro de tres puntas con cascabeles, gorguera y zapatos rizados */
const JOKER = s(
  'o...............o.',
  'oo......o......oo.',
  '.oo....ooo....oo..',
  '..ooo..ooo..ooo...',
  '...ooo.ooo.ooo....',
  '....ooooooooo.....',
  '.....ooooooo......',
  '.....o.ooo.o......',
  '.....ooooooo......',
  '......ooooo.......',
  '...o.o.o.o.o.o....',
  '....ooooooooo.....',
  '...ooooooooooo....',
  '..ooooooooooooo...',
  '..oo.ooooooo.oo...',
  '..o..ooooooo..o...',
  '.....ooooooo......',
  '.....ooo.ooo......',
  '.....oo...oo......',
  '.....oo...oo......',
  '....ooo...ooo.....',
  '..oooo.....oooo...',
  '.oo...........oo..',
);

export const CHARACTERS: Partial<Record<Rank, Sprite>> = {
  K: KING,
  Q: QUEEN,
  J: JACK,
  A: ACE,
  JOKER: JOKER,
};
