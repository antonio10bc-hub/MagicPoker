import { mesa } from './mesa';
import { Theme } from './types';

// Punto ÚNICO de configuración del escenario. Para cambiar de ambientación
// (otro tapete, otra luz...), crea themes/<nombre>/ y apúntalo aquí.
export const ACTIVE_THEME: Theme = mesa;

export type { Theme } from './types';
