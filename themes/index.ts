import { plaza } from './plaza';
import { Theme } from './types';

// Punto ÚNICO de configuración del escenario. Para cambiar de ambientación
// (río, ciudad, bosque...), crea themes/<nombre>/ y apúntalo aquí.
export const ACTIVE_THEME: Theme = plaza;

export type { Theme } from './types';
