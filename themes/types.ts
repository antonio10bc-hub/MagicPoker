import { ComponentType } from 'react';
import { Owner } from '@/types';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Point { x: number; y: number }

/** Dónde caen las cosas en la pantalla interna (384×288) */
export interface BoardLayout {
  /** Caja completa del diorama (incluye cara frontal y sombra) */
  diorama: Rect;
  /** Esquina superior izquierda de cada hueco, por bando, en orden de índice lógico */
  slots: Record<Owner, Point[]>;
  /** Franja central entre bandos (donde aparece "¡PELEA!") */
  centerLine: Rect;
}

/**
 * Un escenario (ambientación). Cambiar de escenario = cambiar ACTIVE_THEME en
 * themes/index.ts. La lógica de juego no sabe nada de esto.
 */
export interface Theme {
  id: string;
  /** Fondo de toda la pantalla, detrás del diorama */
  Backdrop: ComponentType;
  /** Suelo, bordes y decoración del tablero (sin las cartas) */
  Diorama: ComponentType;
  /** Fondo de pantallas sin tablero (menú, final): normalmente el diorama vacío */
  MenuBackground: ComponentType;
  layout: BoardLayout;
}
