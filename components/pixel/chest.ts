import { Sprite } from './PixelSprite';

// --- COFRE DEL CASTILLO (22×14) ---
// Tapa y caja por separado (la tapa salta al abrirlo). Cada una en dos capas: la madera
// ('o', carmesí) y los herrajes ('g', oro).

const layer = (rows: string[], keep: string): Sprite => ({ rows: rows.map(r => r.replace(new RegExp(`[^${keep}]`, 'g'), '.').replace(new RegExp(keep, 'g'), 'o')) });

const LID = [
  '....gggggggggggggg....',
  '...goooooooooooooog...',
  '..goooooooooooooooog..',
  '..goooooooggoooooooog.',
  '.ggggggggggggggggggggg',
];
const BODY = [
  '.gooooooooggooooooooog',
  '.goooooooggggoooooooog',
  '.goooooooggggoooooooog',
  '.gooooooooggooooooooog',
  '.goooooooooooooooooog.',
  '.gggggggggggggggggggg.',
  '.goooooooooooooooooog.',
  '.goooooooooooooooooog.',
  '.gggggggggggggggggggg.',
];

export const CHEST = {
  lid: { wood: layer(LID, 'o'), trim: layer(LID, 'g') },
  body: { wood: layer(BODY, 'o'), trim: layer(BODY, 'g') },
};
