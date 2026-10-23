import { CSSProperties } from 'react';
import { Tier } from '@/lib/forest';
import { INK } from '@/theme/tokens';
import { PixelSprite, spriteSize } from '@/components/pixel/PixelSprite';
import { FOREST_SPRITES } from '@/components/pixel/forest';

// --- GENTE DEL BOSQUE ---
// Dos maneras de verla:
//  - lit:    de rival (panel, bestiario): el cuerpo en el color de su dificultad, que brilla,
//            y la máscara en crema con los ojos huecos.
//  - shadow: entre los árboles: silueta negra, la máscara apenas se adivina y los ojos
//            brillan en el color de su dificultad.

/** Color de cada dificultad: normal crema, difícil naranja, pesadilla carmesí */
export const TIER_INK: Record<Tier, string> = { normal: INK.cream, hard: INK.orange, nightmare: INK.crimson };
export const TIER_RGB: Record<Tier, string> = { normal: '237,235,224', hard: '255,74,28', nightmare: '255,31,75' };

export const ForestFigure = ({ id, tier, height, mode = 'lit', dim, style }: {
  id: string; tier: Tier; height: number; mode?: 'lit' | 'shadow';
  /** Aún sin encontrar (bestiario): apagado, sin máscara */
  dim?: boolean;
  style?: CSSProperties;
}) => {
  const sprite = FOREST_SPRITES[id];
  if (!sprite) return null;
  const { width: w, height: h } = spriteSize(sprite.body);
  const size = { width: (w * height) / h, height };
  const layer: CSSProperties = { position: 'absolute', inset: 0, ...size };
  const glow = `drop-shadow(0 0 2px rgba(${TIER_RGB[tier]},0.95))`;
  const shadow = mode === 'shadow';
  return (
    <div className="relative shrink-0" style={{ ...size, ...style }}>
      <PixelSprite sprite={sprite.body} tint={dim ? INK.slate : shadow ? INK.black : TIER_INK[tier]}
        style={{ ...layer, filter: dim || shadow ? undefined : glow }} />
      {!dim && <PixelSprite sprite={sprite.mask} tint={shadow ? INK.slate : INK.cream} style={layer} />}
      {!dim && (
        <PixelSprite sprite={sprite.eyes} tint={shadow ? TIER_INK[tier] : INK.black}
          style={{ ...layer, filter: shadow ? `${glow} ${glow}` : undefined }} />
      )}
    </div>
  );
};
