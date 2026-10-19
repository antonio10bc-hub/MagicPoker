import { ComponentType } from 'react';
import { BoardGeometry } from '@/theme/layout';

export type { Rect, Point, BoardGeometry } from '@/theme/layout';

/**
 * Un escenario (ambientación). Cambiar de escenario = cambiar ACTIVE_THEME en
 * themes/index.ts. La lógica de juego no sabe nada de esto.
 *
 * La geometría (dónde va el diorama y cada hueco) la calcula theme/layout.ts según
 * el tamaño de pantalla; el escenario solo decide CÓMO se dibuja.
 */
export interface Theme {
  id: string;
  /** Fondo de toda la pantalla, detrás del diorama (ocupa el 100 % del escenario) */
  Backdrop: ComponentType;
  /** Suelo, bordes y decoración del tablero (sin las cartas) */
  Diorama: ComponentType<{ board: BoardGeometry }>;
}
