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
  /** Grimorio: el libro de todas las cartas (lomo, cruz en la tapa, canto de las páginas) */
  book: s(
    '.nnnnnnn.',
    'n.n.....n',
    'n.n..n..n',
    'n.n.nnn.n',
    'n.n..n..n',
    'n.n..n..n',
    'n.nnnnnnn',
    'n.n.....n',
    '.nnnnnnnn',
  ),
  /** Carta con una pica (pestaña Cartas del Grimorio) */
  card: s(
    '.nnnnnnn.',
    'n.......n',
    'n...n...n',
    'n..nnn..n',
    'n.nnnnn.n',
    'n...n...n',
    'n..nnn..n',
    'n.......n',
    '.nnnnnnn.',
  ),
  /** Castillo almenado (pestaña Castillo del Grimorio) */
  castle: s(
    'n.n...n.n',
    'nnn.n.nnn',
    'nnnnnnnnn',
    '.nnnnnnn.',
    '.nn.n.nn.',
    '.nnnnnnn.',
    '.nnn.nnn.',
    '.nn...nn.',
    'nnn...nnn',
  ),
  /** Mazo: cartas apiladas */
  deck: s(
    '..nnnnnn.',
    '..n....n.',
    'nnnnnn.n.',
    'n....n.n.',
    'n....n.n.',
    'n....n.n.',
    'n....nnn.',
    'n....n...',
    'nnnnnn...',
  ),
  /** Pausa: dos barras */
  pause: s(
    'nnn.nnn',
    'nnn.nnn',
    'nnn.nnn',
    'nnn.nnn',
    'nnn.nnn',
    'nnn.nnn',
    'nnn.nnn',
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

/** Llama (logro Inmolación) 9×9 */
export const FLAME = s(
  '....n....',
  '...nn....',
  '...nnn.n.',
  '..nnnn.n.',
  '.nnnnnnn.',
  '.nnn.nnn.',
  'nnn...nnn',
  'nnn...nnn',
  '.nnnnnnn.',
);

/** Máscara del bosque (logro del bestiario) 9×9 */
export const MASK = s(
  '.nnnnnnn.',
  'nnnnnnnnn',
  'nn..n..nn',
  'nn..n..nn',
  'nnnnnnnnn',
  '.nnnnnnn.',
  '.nn...nn.',
  '..nnnnn..',
  '...nnn...',
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

/** Halo del Ángel (puntos de guardado del Castillo), para teñir */
export const HALO = s(
  '.xxx.',
  'x...x',
  '.xxx.',
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
  /** Espejo: espejo de mano con reflejo */
  mirror: s(
    '..ooooo..',
    '.oo...oo.',
    '.o.o...o.',
    '.o..o..o.',
    '.oo...oo.',
    '..ooooo..',
    '....o....',
    '....o....',
    '...ooo...',
  ),
  /** Veneno: gota */
  poison: s(
    '....o....',
    '....o....',
    '...ooo...',
    '..ooooo..',
    '.ooo.ooo.',
    '.oo..ooo.',
    '.ooooooo.',
    '..ooooo..',
    '...ooo...',
  ),
  /** Eco: ondas que se repiten */
  echo: s(
    'o..o..o..',
    '.o..o..o.',
    '.o..o..o.',
    '..o..o..o',
    '..o..o..o',
    '..o..o..o',
    '.o..o..o.',
    '.o..o..o.',
    'o..o..o..',
  ),
  /** Ancla */
  anchor: s(
    '...ooo...',
    '...o.o...',
    '...ooo...',
    '.ooooooo.',
    '....o....',
    'o...o...o',
    'oo..o..oo',
    '.ooooooo.',
    '...ooo...',
  ),
  /** Revelar: ojo */
  reveal: s(
    '.........',
    '...ooo...',
    '.oo...oo.',
    'o..ooo..o',
    'o.oo.oo.o',
    'o..ooo..o',
    '.oo...oo.',
    '...ooo...',
    '.........',
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

// --- CARTAS DEL CASTILLO (18×23) ---
/** Bufón: gorro de tres puntas con cascabeles */
const JESTER = s(
  '..o......o......o.',
  '.o.oo....o....oo.o',
  '.....oo..o..oo....',
  '.......ooooo......',
  '.....ooooooooo....',
  '.....ooooooooo....',
  '.......oooo.......',
  '......oooooo......',
  '......oo.o.o......',
  '.......oooo.......',
  '........oo........',
  '....o.o.o.o.o.o...',
  '.....ooooooooo.o..',
  '.....ooooooooo....',
  '.....ooooooooo....',
  '....ooooooooooo...',
  '....ooooooooooo...',
  '....ooooooooooo...',
  '.....oo.....oo....',
  '.....oo.....oo....',
  '.....oo.....oo....',
  '.....oo.....oo....',
  '.....oo.....oo....',
);

/** Torre: almenas y ventana */
const TOWER = s(
  '..................',
  '...oo..oo..oo..oo.',
  '...oo..oo..oo..oo.',
  '...oooooooooooooo.',
  '...oooooooooooooo.',
  '...oooooooooooooo.',
  '.....oooooooooo...',
  '.....oooooooooo...',
  '.....oooooooooo...',
  '.....oooo..oooo...',
  '.....oooo..oooo...',
  '.....oooo..oooo...',
  '.....oooo..oooo...',
  '.....oooooooooo...',
  '.....oooooooooo...',
  '.....oooooooooo...',
  '.....oooooooooo...',
  '.....oooo..oooo...',
  '.....ooo....ooo...',
  '.....ooo....ooo...',
  '.....ooo....ooo...',
  '.....ooo....ooo...',
  '.....ooo....ooo...',
);

/** Bomba: esfera con la mecha encendida */
const BOMB = s(
  '.............o.o..',
  '..............o...',
  '.............o.o..',
  '............o.....',
  '...........o......',
  '..........o.......',
  '........ooo.......',
  '......oooooo......',
  '.....oooooooo.....',
  '....oooooooooo....',
  '...oooo.ooooooo...',
  '..oooo.ooooooooo..',
  '..oooooooooooooo..',
  '..oooooooooooooo..',
  '..oooooooooooooo..',
  '..oooooooooooooo..',
  '..oooooooooooooo..',
  '...oooooooooooo...',
  '....oooooooooo....',
  '.....oooooooo.....',
  '......oooooo......',
  '..................',
  '..................',
);

/** Espía: sombrero de ala y gabardina */
const SPY = s(
  '..................',
  '......ooooooo.....',
  '......ooooooo.....',
  '......ooooooo.....',
  '......ooooooo.....',
  '...ooooooooooooo..',
  '.......oooo.......',
  '......oooooo......',
  '......o...........',
  '......ooooooo.....',
  '.....ooooooooo....',
  '.....ooooooooo....',
  '.....ooooooooo....',
  '.....ooooooooo....',
  '.....ooooooooo....',
  '.....ooooooooo....',
  '.....ooooooooo....',
  '.....ooooooooo....',
  '....ooooooooooo...',
  '....ooooooooooo...',
  '....ooooooooooo...',
  '......oo...oo.....',
  '......oo...oo.....',
);

/** Caballero: yelmo con penacho y lanza */
const KNIGHT = s(
  '....ooo.........o.',
  '......ooo......ooo',
  '........oo....o.o.',
  '......ooooooo...o.',
  '......ooooooo...o.',
  '......ooooooo...o.',
  '......o.....o...o.',
  '......ooooooo...o.',
  '......ooooooo...o.',
  '......ooooooo...o.',
  '.....ooooooooo..o.',
  '.....oooooooooooo.',
  '.....oooooooooooo.',
  '.....ooooooooo..o.',
  '....ooooooooooo.o.',
  '....ooooooooooo.o.',
  '....ooooooooooo.o.',
  '....ooooooooooo.o.',
  '....ooooooooooo.o.',
  '.....ooo...ooo..o.',
  '.....ooo...ooo..o.',
  '.....ooo...ooo..o.',
  '.....ooo...ooo..o.',
);

/** Sacerdotisa: tocado de media luna y túnica larga */
const PRIESTESS = s(
  '......o....o......',
  '.....oo....oo.....',
  '.....oooooooo.....',
  '......oooooo......',
  '.......oooo.......',
  '.......oooo.......',
  '......oo.o.o......',
  '.......oooo.......',
  '.......oooo.......',
  '......ooooooo.....',
  '......ooooooo.....',
  '.....ooooooooo....',
  '.....ooo.o.ooo....',
  '.....ooo.o.ooo....',
  '....oooo...oooo...',
  '....ooooooooooo...',
  '....ooooooooooo...',
  '....ooooooooooo...',
  '...ooooooooooooo..',
  '...ooooooooooooo..',
  '...ooooooooooooo..',
  '..ooooooooooooooo.',
  '..ooooooooooooooo.',
);

/** Dragón: cuernos, alas y cola (legendaria) */
const DRAGON = s(
  '..o.........o.....',
  '..oo.......oo.....',
  '...oo.....oo......',
  '...ooooooooo......',
  '..ooooooooooo.....',
  '..oo.ooooo.oo.....',
  '..ooooooooooo.....',
  '...ooooooooo......',
  '....o.o.o.o.......',
  'o...ooooooo....o..',
  'oo..ooooooooo.oo..',
  'ooo.ooooooooooooo.',
  'oooooooooooooooo..',
  '.oooooooooooooo...',
  '..ooooooooooooo...',
  '...oooooooooooo...',
  '....ooooooooooo...',
  '....ooooooooooooo.',
  '....oooo...oooo.oo',
  '....ooo.....ooo..o',
  '...oooo.....oooo.o',
  '...oooo.....oooo..',
  '..................',
);

/** Hidra: tres cuellos con cabeza sobre un cuerpo enorme (legendaria) */
const HYDRA = s(
  '.o.......o.......o',
  'ooo.....ooo.....oo',
  'o.o.....o.o.....o.',
  'ooo.....ooo....oo.',
  '.oo......oo...oo..',
  '..oo.....oo..oo...',
  '...oo....oo.oo....',
  '....oo...oooo.....',
  '.....oooooooo.....',
  '.....ooooooooo....',
  '....ooooooooooo...',
  '....ooooooooooo...',
  '...ooooooooooooo..',
  '...ooooooooooooo..',
  '...ooooooooooooo..',
  '...oooooooooooooo.',
  '....ooooooooooooo.',
  '.....oooooooooooo.',
  '......oooooooooooo',
  '.......ooo...ooo.o',
  '.......ooo...ooo..',
  '......oooo..oooo..',
  '..................',
);

/** Fénix: cresta de llama y alas abiertas (legendaria) */
const PHOENIX = s(
  '........o.........',
  '.......ooo........',
  '........o.........',
  '.......ooo........',
  '......ooooo.......',
  '.......o.o........',
  '.......ooo........',
  'o.......o.......o.',
  'oo.....ooo.....oo.',
  'ooo...ooooo...ooo.',
  '.oooo.ooooo.oooo..',
  '.oooooooooooooooo.',
  '..ooooooooooooo...',
  '...ooooooooooo....',
  '....ooooooooo.....',
  '.....ooooooo......',
  '......ooooo.......',
  '.....oo.o.oo......',
  '....oo..o..oo.....',
  '...oo...o...oo....',
  '..o.....o.....o...',
  '........o.........',
  '..................',
);

export const CHARACTERS: Partial<Record<Rank, Sprite>> = {
  K: KING,
  Q: QUEEN,
  J: JACK,
  A: ACE,
  JOKER: JOKER,
  JESTER, TOWER, BOMB, SPY, KNIGHT, PRIESTESS,
  DRAGON, HYDRA, PHOENIX,
};
