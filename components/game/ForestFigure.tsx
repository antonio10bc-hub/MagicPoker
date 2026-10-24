import { CSSProperties } from 'react';
import { Tier } from '@/lib/forest';
import { INK } from '@/theme/tokens';
import { PixelSprite, spriteSize } from '@/components/pixel/PixelSprite';
import { FOREST_SPRITES } from '@/components/pixel/forest';
import { spriteAura } from '@/components/pixel/bosses';

// --- GENTE DEL BOSQUE ---
// Dos maneras de verla:
//  - lit:    de rival (panel, bestiario): el cuerpo en el color de su dificultad, que brilla,
//            y la máscara en crema con los ojos huecos.
//  - shadow: entre los árboles: silueta negra, la máscara apenas se adivina y los ojos
//            brillan en el color de su dificultad.

/** Color de cada nivel: normal crema, difícil naranja, pesadilla carmesí, únicos oro */
export const TIER_INK: Record<Tier, string> = { normal: INK.cream, hard: INK.orange, nightmare: INK.crimson, unique: INK.gold };
export const TIER_RGB: Record<Tier, string> = { normal: '237,235,224', hard: '255,74,28', nightmare: '255,31,75', unique: '232,182,74' };

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
  // Los únicos (la realeza): aura de oro y carmesí, resplandor y, en grande, rayos girando
  const royal = tier === 'unique' && !dim;
  return (
    <div className="relative shrink-0" style={{ ...size, ...style }}>
      {royal && (
        <>
          {size.height >= 40 && (
            <div className="absolute pointer-events-none rounded-full" style={{ left: '-90%', top: `${50 - (140 * size.width) / size.height}%`, width: '280%', height: `${(280 * size.width) / size.height}%`,
              maskImage: 'radial-gradient(circle, #000 25%, transparent 68%)', WebkitMaskImage: 'radial-gradient(circle, #000 25%, transparent 68%)' }}>
              <div className="absolute inset-0 rounded-full anim-spin" style={{ background: 'repeating-conic-gradient(rgba(255,214,120,0.55) 0deg 8deg, transparent 8deg 18deg, rgba(255,31,75,0.45) 18deg 25deg, transparent 25deg 36deg)' }} />
            </div>
          )}
          <div className="absolute pointer-events-none anim-pulse-soft" style={{ left: '-50%', top: '-25%', width: '200%', height: '150%',
            background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255,233,168,0.55) 0%, rgba(232,182,74,0.25) 40%, transparent 70%)' }} />
          <PixelSprite sprite={spriteAura(sprite.body, 2, `forest-${id}-2`)} tint={INK.gold} className="anim-pulse bloom-gold-shape" style={layer} />
          <PixelSprite sprite={spriteAura(sprite.body, 4, `forest-${id}-4`)} tint={INK.crimson} className="anim-flicker bloom-crimson-shape" style={layer} />
        </>
      )}
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
