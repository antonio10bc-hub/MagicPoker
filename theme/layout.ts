import { Owner } from '@/types';
import { CARD_SIZE, STAGE } from './tokens';

// --- DISTRIBUCIÓN DE PANTALLA ---
// Todas las posiciones (en píxeles internos) salen de aquí, a partir del tamaño del
// escenario. Hay dos modos:
//  - landscape: ordenador / móvil en horizontal. Escenario fijo de 384×288.
//  - portrait:  móvil en vertical. Ancho ~200–260 px internos y alto variable para
//               llenar la pantalla; mano y botón de acción abajo (zona del pulgar).

export type StageMode = 'landscape' | 'portrait';

export interface StageSize {
  width: number;
  height: number;
  /** Píxeles CSS por píxel interno */
  scale: number;
  mode: StageMode;
}

export interface Rect { x: number; y: number; w: number; h: number }
export interface Point { x: number; y: number }

// --- GEOMETRÍA DEL TABLERO (tapete) ---

export interface BoardGeometry {
  /** Caja completa: cara superior + canto frontal */
  diorama: Rect;
  /** Altura del canto frontal */
  faceHeight: number;
  rim: number;
  /** Esquina superior izquierda de cada hueco, por bando, en orden de índice lógico */
  slots: Record<Owner, Point[]>;
  /** Línea central entre bandos */
  strip: Rect;
  /** Zona donde aparece "¡PELEA!" */
  centerLine: Rect;
}

/** Lo que sobresale por encima del tapete (solo el halo del borde) */
export const DIORAMA_OVERHANG = 4;
/** Sombra proyectada bajo el tapete */
export const DIORAMA_SHADOW = 6;

const RIM = 4;

const metrics = (compact: boolean) => ({
  /** Del borde del tapete a la fila de cartas (arriba y abajo) */
  edge: compact ? 9 : 10,
  /** Hueco mínimo entre las dos filas (incluye la línea central) */
  center: compact ? 16 : 20,
  stripH: compact ? 4 : 6,
  face: compact ? 6 : 8,
});

/** Altura mínima del tapete */
export const boardMinHeight = (compact = false) => {
  const m = metrics(compact);
  return 2 * m.edge + 2 * CARD_SIZE.height + m.center + m.face;
};

/** Lo máximo que crece el centro entre filas: más allá, el espacio va a los bordes */
const CENTER_GROW_MAX = 30;

/**
 * Geometría del tapete. Con `height` mayor que el mínimo, el espacio sobrante ensancha
 * primero el centro (entre las dos filas, donde pasan los carteles sin tapar cartas)
 * y luego los bordes, así el tapete crece sin descolocar nada.
 */
export const computeBoard = (x: number, y: number, w: number, compact = false, height?: number): BoardGeometry => {
  const m = metrics(compact);
  const gap = Math.max(2, Math.min(12, Math.floor((w - 2 * RIM - 4 - 4 * CARD_SIZE.width) / 3)));
  const rowW = 4 * CARD_SIZE.width + 3 * gap;
  const x0 = x + Math.floor((w - rowW) / 2);
  const minH = boardMinHeight(compact);
  const h = Math.max(minH, Math.round(height ?? minH));
  const extra = h - minH;
  const centerExtra = Math.min(CENTER_GROW_MAX, Math.round(extra * 0.6));
  const edgeExtra = Math.floor((extra - centerExtra) / 2);
  const center = m.center + centerExtra;
  const rivalY = y + m.edge + edgeExtra;
  const playerY = rivalY + CARD_SIZE.height + center;
  const stripY = rivalY + CARD_SIZE.height + Math.round((center - m.stripH) / 2);
  const row = (rowY: number) => [0, 1, 2, 3].map(i => ({ x: x0 + i * (CARD_SIZE.width + gap), y: rowY }));

  return {
    diorama: { x, y, w, h },
    faceHeight: m.face,
    rim: RIM,
    slots: { opponent: row(rivalY), player: row(playerY) },
    strip: { x: x + RIM + 6, y: stripY, w: w - 2 * RIM - 12, h: m.stripH },
    centerLine: { x: x + RIM, y: stripY - 4, w: w - 2 * RIM, h: m.stripH + 8 },
  };
};

// --- PANTALLA DE PARTIDA ---

export interface GameLayout {
  mode: StageMode;
  board: BoardGeometry;
  rivalPanel: Rect;
  playerPanel: Rect;
  menuButtons: Point;
  /** Lado de los botones de menú (4 botones en fila) */
  menuButtonSize: number;
  turnBox: Rect;
  actionButton: Rect;
  /** Zona de la mano: cartas alineadas en y, centradas en [x, x + w], a la escala indicada */
  hand: { x: number; y: number; w: number; scale: number };
  /** Paneles en fila (vertical) o en columna (horizontal) */
  compactPanels: boolean;
  /** Horizontal: marco de la columna izquierda y contador de ronda dentro de él */
  sidebar: Rect;
  roundBox: Rect;
}

const M = 4; // margen
/** Escalas de la mano (la carta mide 40×56: ambas dan píxeles enteros) */
const HAND_SCALE_BIG = 1.375;
const HAND_SCALE_SMALL = 0.875;
/** Lo máximo que crece el tapete en móviles altos */
const BOARD_GROW_MAX = 80;

/** Horizontal: ancho máximo de la zona de juego (en ultrapanorámico, centrada; el fondo llena el resto) */
const PLAY_MAX_W = 600;

export const computeGameLayout = ({ width: stageW, height: H, mode }: StageSize): GameLayout => {
  if (mode === 'landscape') {
    // En pantallas muy anchas la mesa y sus columnas no se separan más: van juntas en el centro
    const W = Math.min(stageW, PLAY_MAX_W);
    const ox = Math.floor((stageW - W) / 2);
    return shift(landscapeGame(W, H), ox);
  }
  return portraitGame(stageW, H);
};

const shiftRect = (r: Rect, dx: number): Rect => ({ ...r, x: r.x + dx });
const shift = (l: GameLayout, dx: number): GameLayout => (dx === 0 ? l : {
  ...l,
  board: {
    ...l.board,
    diorama: shiftRect(l.board.diorama, dx),
    slots: { player: l.board.slots.player.map(p => ({ ...p, x: p.x + dx })), opponent: l.board.slots.opponent.map(p => ({ ...p, x: p.x + dx })) },
    strip: shiftRect(l.board.strip, dx),
    centerLine: shiftRect(l.board.centerLine, dx),
  },
  rivalPanel: shiftRect(l.rivalPanel, dx),
  playerPanel: shiftRect(l.playerPanel, dx),
  menuButtons: { ...l.menuButtons, x: l.menuButtons.x + dx },
  turnBox: shiftRect(l.turnBox, dx),
  actionButton: shiftRect(l.actionButton, dx),
  hand: { ...l.hand, x: l.hand.x + dx },
  sidebar: shiftRect(l.sidebar, dx),
  roundBox: shiftRect(l.roundBox, dx),
});

const landscapeGame = (W: number, H: number): GameLayout => {
  // Horizontal (ordenador): columna de paneles a la izquierda, turno y acción a la
  // derecha y, en medio, el tablero con la mano debajo. En 4:3 (384 de ancho) las
  // columnas son estrechas y la mano algo más pequeña que la mesa; en panorámico
  // las columnas se ensanchan (cabe el nombre del jefe) y la mano va a tamaño real.
  const wide = W >= 440;
  const side = wide ? 84 : 62;
  const right = wide ? 84 : 66;
  const midX = M + side + (wide ? 8 : 4);
  const midW = W - M - right - (wide ? 8 : 4) - midX;
  const handScale = wide ? 1 : HAND_SCALE_SMALL;
  const handH = Math.round(CARD_SIZE.height * handScale);
  // Margen bajo la mano: las cartas de los extremos bajan y giran en abanico
  const handY = H - M - handH - (wide ? 10 : 6);
  const top = wide ? 10 : 12;
  const available = handY - (wide ? 6 : 15) - top;
  const boardH = Math.max(boardMinHeight(), Math.min(wide ? 212 : 196, available - DIORAMA_SHADOW));
  const boardY = top + Math.max(0, Math.floor((available - boardH - DIORAMA_SHADOW) / 2));
  const boardW = Math.min(wide ? 264 : 240, midW);
  const buttonSize = wide ? 18 : 14;
  const buttonsY = M + 62 + 4;
  const roundY = buttonsY + buttonSize + (wide ? 8 : 12);
  const playerH = wide ? 58 : 54;
  const actionH = wide ? 26 : 22;
  return {
    mode: 'landscape',
    board: computeBoard(midX + Math.floor((midW - boardW) / 2), boardY, boardW, false, boardH),
    rivalPanel: { x: M, y: M, w: side, h: 62 },
    playerPanel: { x: M, y: H - M - playerH, w: side, h: playerH },
    menuButtons: { x: M, y: buttonsY },
    menuButtonSize: buttonSize,
    turnBox: { x: W - M - right, y: M, w: right, h: 36 },
    // En panorámico, a la altura de la mano (donde ya está el ratón); en 4:3, sobre ella
    actionButton: wide
      ? { x: W - M - right, y: handY + Math.round((handH - actionH) / 2), w: right, h: actionH }
      : { x: W - M - right, y: 196, w: right, h: actionH },
    hand: { x: midX, y: handY, w: midW, scale: handScale },
    compactPanels: false,
    sidebar: { x: 1, y: 1, w: side + 2 * M - 2, h: H - 2 },
    roundBox: { x: M + 2, y: roundY, w: side - 4, h: 44 },
  };
};

const portraitGame = (W: number, H: number): GameLayout => {
  // Vertical: de abajo arriba → mano y fila del jugador (panel + acción) en la zona del
  // pulgar; arriba → barra del rival; entre la barra y el tablero, en el hueco que dejan
  // farolas y banderolas, el cuadro de turno y los botones de menú. El tablero se centra.
  // En móviles altos la mano se dibuja a ×1,375 (55×77, píxeles enteros) si cabe; si no, ×0,875
  const boardW = W - 2 * M;
  const boardMin = boardMinHeight(true);
  const top = M + 28 + DIORAMA_OVERHANG + 2;
  const handScale = H - M - HAND_SCALE_BIG * CARD_SIZE.height - 10 - 28 - 6 - top >= boardMin + DIORAMA_SHADOW ? HAND_SCALE_BIG : HAND_SCALE_SMALL;
  const handY = H - M - Math.round(CARD_SIZE.height * handScale);
  const playerRowY = handY - 10 - 28;
  const statusY = M + 28 + 3;
  const available = playerRowY - 6 - top;
  // El tablero ocupa el hueco disponible (hasta un tope) ensanchando el centro
  const boardH = Math.max(boardMin, Math.min(boardMin + BOARD_GROW_MAX, available - DIORAMA_SHADOW));
  const boardY = top + Math.max(0, Math.floor((available - boardH - DIORAMA_SHADOW) / 2));
  const actionW = Math.min(78, Math.floor(W * 0.4));
  const buttonsW = 4 * 18 + 3 * 3;

  return {
    mode: 'portrait',
    board: computeBoard(M, boardY, boardW, true, boardH),
    rivalPanel: { x: M, y: M, w: W - 2 * M, h: 28 },
    menuButtons: { x: W - M - buttonsW, y: statusY },
    menuButtonSize: 18,
    turnBox: { x: M, y: statusY, w: W - 2 * M - buttonsW - 4, h: 16 },
    playerPanel: { x: M, y: playerRowY, w: W - 2 * M - actionW - 4, h: 28 },
    actionButton: { x: W - M - actionW, y: playerRowY + 3, w: actionW, h: 22 },
    hand: { x: M, y: handY, w: W - 2 * M, scale: handScale },
    compactPanels: true,
    sidebar: { x: 0, y: 0, w: 0, h: 0 },
    roundBox: { x: 0, y: 0, w: 0, h: 0 },
  };
};

// --- MENÚ Y PANTALLA FINAL ---

export interface MenuLayout {
  board: BoardGeometry;
  /** Centro horizontal del tapete (boss y botones) */
  cx: number;
  /** Boss del menú: escala de la silueta y alto de la zona deslizable */
  bossScale: number;
  bossY: number;
  bossH: number;
  /** Botón JUGAR (y debajo, CONTINUAR PARTIDA) */
  playY: number;
  /** Base de las dos siluetas, de pie en el centro del tapete */
  mascotY: number;
  /** Menú: el mapa de jefes, y lo que le tapan arriba (cabecera) y abajo (acción principal) */
  map: Rect;
  mapSafeTop: number;
  mapSafeBottom: number;
  /** Menú: columna de la acción principal (x, ancho) y su borde inferior */
  cta: { x: number; w: number; bottom: number };
  /** Menú: tamaño del logo pequeño de arriba a la izquierda */
  logoSize: number;
}

const LOGO_HEIGHT = 76;

export const computeMenuLayout = ({ width: W, height: H, mode }: StageSize): MenuLayout => {
  if (mode === 'landscape') {
    // Horizontal: igual que en vertical, el mapa llena la pantalla y la interfaz flota
    // encima (logo arriba a la izquierda, iconos arriba a la derecha, acción centrada
    // abajo). El tapete es el de la pantalla final: centrado
    const boardX = Math.floor((W - 222) / 2);
    const dy = Math.floor((H - STAGE.height) / 2);
    const board = computeBoard(boardX, 14 + dy, 222, false, 204);
    const ctaW = Math.min(190, W - 24);
    return {
      board, cx: boardX + 111,
      bossScale: 3, bossY: 26 + dy, bossH: 180, mascotY: 92 + dy, playY: 226 + dy,
      map: { x: 0, y: 0, w: W, h: H }, mapSafeTop: 40, mapSafeBottom: 62,
      cta: { x: Math.floor((W - ctaW) / 2), w: ctaW, bottom: 12 },
      logoSize: 21,
    };
  }
  // Vertical: logo arriba, tapete en el centro con las siluetas, JUGAR debajo
  const BUTTONS_H = 62;
  // En pantallas bajas el tapete crece menos para que todo quepa
  const boardH = boardMinHeight(true) + (H < 360 ? 4 : 16);
  const block = LOGO_HEIGHT + DIORAMA_OVERHANG + boardH + DIORAMA_SHADOW + 10 + BUTTONS_H;
  // Nunca por encima de la fila de iconos (reglas, estadísticas, ajustes)
  const top = Math.max(22, Math.floor((H - block) / 2));
  const boardY = top + LOGO_HEIGHT + DIORAMA_OVERHANG;
  return {
    board: computeBoard(M, boardY, W - 2 * M, true, boardH),
    cx: Math.floor(W / 2),
    // El boss, grande y centrado sobre el tapete (×3 si cabe con su nombre debajo)
    bossScale: boardH >= 42 * 3 + 30 ? 3 : 2,
    bossY: boardY + 4,
    bossH: boardH - 8,
    mascotY: boardY + Math.round(boardH / 2) - 26,
    playY: boardY + boardH + DIORAMA_SHADOW + 10,
    // El mapa ocupa toda la pantalla; la cabecera y la acción flotan encima
    map: { x: 0, y: 0, w: W, h: H }, mapSafeTop: 44, mapSafeBottom: 92,
    cta: { x: Math.floor((W - Math.min(170, W - 24)) / 2), w: Math.min(170, W - 24), bottom: 24 },
    logoSize: 19,
  };
};

export const LANDSCAPE_STAGE: StageSize = { width: STAGE.width, height: STAGE.height, scale: 2, mode: 'landscape' };
