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

// --- GEOMETRÍA DEL TABLERO (diorama) ---

export interface BoardGeometry {
  /** Caja completa: cara superior + cara frontal */
  diorama: Rect;
  /** Altura de la cara frontal (sillares) */
  faceHeight: number;
  rim: number;
  /** Esquina superior izquierda de cada hueco, por bando, en orden de índice lógico */
  slots: Record<Owner, Point[]>;
  /** Franja decorativa entre bandos */
  strip: Rect;
  /** Zona donde aparece "¡PELEA!" */
  centerLine: Rect;
  railing: Rect;
}

export const DIORAMA_HEIGHT = 184;
/** Diorama compacto (móvil vertical): menos márgenes, misma escala de cartas */
export const DIORAMA_HEIGHT_COMPACT = 164;
/** Lo que sobresalen farolas y banderolas por encima del diorama */
export const DIORAMA_OVERHANG = 20;
/** Sombra proyectada bajo el diorama */
export const DIORAMA_SHADOW = 6;

const RIM = 4;

export const computeBoard = (x: number, y: number, w: number, compact = false): BoardGeometry => {
  // En pantallas estrechas las banderolas se superponen al borde para dejar sitio a las cartas
  const sideRoom = w >= 210 ? 14 : 0;
  const gap = Math.max(2, Math.min(12, Math.floor((w - 2 * RIM - 2 * sideRoom - 4 * CARD_SIZE.width) / 3)));
  const rowW = 4 * CARD_SIZE.width + 3 * gap;
  const x0 = x + Math.floor((w - rowW) / 2);
  const pad = compact ? 4 : 6;
  const rivalY = y + (compact ? 7 : 10);
  const stripH = compact ? 6 : 8;
  const stripY = rivalY + CARD_SIZE.height + pad;
  const playerY = stripY + stripH + pad;
  const railY = playerY + CARD_SIZE.height + pad;
  const row = (rowY: number) => [0, 1, 2, 3].map(i => ({ x: x0 + i * (CARD_SIZE.width + gap), y: rowY }));

  return {
    diorama: { x, y, w, h: compact ? DIORAMA_HEIGHT_COMPACT : DIORAMA_HEIGHT },
    faceHeight: compact ? 10 : 14,
    rim: RIM,
    slots: { opponent: row(rivalY), player: row(playerY) },
    strip: { x: x + RIM, y: stripY, w: w - 2 * RIM, h: stripH },
    centerLine: { x: x + RIM, y: stripY - 2, w: w - 2 * RIM, h: stripH + 4 },
    railing: { x: x + RIM, y: railY, w: w - 2 * RIM, h: compact ? 10 : 13 },
  };
};

// --- PANTALLA DE PARTIDA ---

export interface GameLayout {
  mode: StageMode;
  board: BoardGeometry;
  rivalPanel: Rect;
  playerPanel: Rect;
  menuButtons: Point;
  turnBox: Rect;
  actionButton: Rect;
  /** Zona de la mano: cartas alineadas en y, centradas en [x, x + w], a la escala indicada */
  hand: { x: number; y: number; w: number; scale: number };
  /** Paneles en fila (vertical) o en columna (horizontal) */
  compactPanels: boolean;
}

const M = 4; // margen

export const computeGameLayout = ({ width: W, height: H, mode }: StageSize): GameLayout => {
  if (mode === 'landscape') {
    return {
      mode,
      board: computeBoard(70, 24, 240),
      rivalPanel: { x: M, y: M, w: 62, h: 62 },
      playerPanel: { x: M, y: 230, w: 62, h: 54 },
      menuButtons: { x: M, y: 70 },
      turnBox: { x: 314, y: M, w: 66, h: 36 },
      actionButton: { x: 314, y: 196, w: 66, h: 22 },
      hand: { x: 72, y: 226, w: 236, scale: 1 },
      compactPanels: false,
    };
  }

  // Vertical: de abajo arriba → mano y fila del jugador (panel + acción) en la zona del
  // pulgar; arriba → barra del rival; entre la barra y el tablero, en el hueco que dejan
  // farolas y banderolas, el cuadro de turno y los botones de menú. El tablero se centra.
  // En móviles altos la mano se dibuja a ×1,5 (sigue cayendo en píxeles enteros) si cabe
  const handScale = H - M - 1.5 * CARD_SIZE.height - 10 - 28 - 6 - (M + 28 + DIORAMA_OVERHANG + 2) >= DIORAMA_HEIGHT_COMPACT + DIORAMA_SHADOW ? 1.5 : 1;
  const handY = H - M - Math.round(CARD_SIZE.height * handScale);
  const playerRowY = handY - 10 - 28;
  const statusY = M + 28 + 3;
  const top = M + 28 + DIORAMA_OVERHANG + 2;
  const available = playerRowY - 6 - top;
  const boardY = top + Math.max(0, Math.floor((available - DIORAMA_HEIGHT_COMPACT - DIORAMA_SHADOW) / 2));
  const actionW = Math.min(78, Math.floor(W * 0.4));
  const buttonsW = 3 * 18 + 2 * 3;

  return {
    mode,
    board: computeBoard(M, boardY, W - 2 * M, true),
    rivalPanel: { x: M, y: M, w: W - 2 * M, h: 28 },
    menuButtons: { x: W - M - buttonsW, y: statusY },
    turnBox: { x: M, y: statusY, w: W - 2 * M - buttonsW - 4, h: 16 },
    playerPanel: { x: M, y: playerRowY, w: W - 2 * M - actionW - 4, h: 28 },
    actionButton: { x: W - M - actionW, y: playerRowY + 3, w: actionW, h: 22 },
    hand: { x: M, y: handY, w: W - 2 * M, scale: handScale },
    compactPanels: true,
  };
};

// --- MENÚ Y PANTALLA FINAL ---

export interface MenuLayout {
  board: BoardGeometry;
  cx: number;
  logoY: number;
  playY: number;
  /** Panel de dificultad */
  difficultyY: number;
  panelW: number;
}

const LOGO_HEIGHT = 76;

export const computeMenuLayout = ({ width: W, height: H, mode }: StageSize): MenuLayout => {
  if (mode === 'landscape') {
    return { board: computeBoard(70, 24, 240), cx: W / 2, logoY: 34, playY: 126, difficultyY: 176, panelW: 180 };
  }
  // Vertical: logo arriba, plaza en el centro con el botón JUGAR, dificultad debajo
  const PANEL_H = 44;
  const block = LOGO_HEIGHT + DIORAMA_OVERHANG + DIORAMA_HEIGHT_COMPACT + DIORAMA_SHADOW + 10 + PANEL_H;
  const top = Math.max(M, Math.floor((H - block) / 2));
  const boardY = top + LOGO_HEIGHT + DIORAMA_OVERHANG;
  return {
    board: computeBoard(M, boardY, W - 2 * M, true),
    cx: Math.floor(W / 2),
    logoY: top,
    playY: boardY + 92,
    difficultyY: boardY + DIORAMA_HEIGHT_COMPACT + DIORAMA_SHADOW + 10,
    panelW: Math.min(180, W - 16),
  };
};

export const LANDSCAPE_STAGE: StageSize = { width: STAGE.width, height: STAGE.height, scale: 2, mode: 'landscape' };
