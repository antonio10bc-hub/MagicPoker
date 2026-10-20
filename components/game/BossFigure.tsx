import { CSSProperties } from 'react';
import { INK } from '@/theme/tokens';
import { PixelSprite, spriteSize } from '@/components/pixel/PixelSprite';
import { BOSS_SPRITES, evolvedLayer } from '@/components/pixel/bosses';

// --- SILUETA DE BOSS ---
// Cuerpo en naranja (o en negro, sobre fondos naranjas) y su sello en verde eléctrico,
// en dos capas superpuestas. `height` reduce la figura sin redondear a píxeles enteros.

export const BossFigure = ({ id, scale = 1, height, dark, dim, glow = true, evolved, style }: {
  id: string; scale?: number; height?: number;
  /** Versión del Castillo: con su "evolución" en rojo eléctrico */
  evolved?: boolean;
  /** Silueta negra (para dibujarla sobre una banda naranja) */
  dark?: boolean;
  /** Apagado: boss todavía bloqueado */
  dim?: boolean;
  glow?: boolean;
  style?: CSSProperties;
}) => {
  const sprite = BOSS_SPRITES[id];
  const { width: w, height: h } = spriteSize(sprite.body);
  const k = height ? height / h : scale;
  const size = { width: w * k, height: h * k };
  const bodyColor = dim ? INK.slate : dark ? INK.black : INK.orange;
  return (
    <div className="relative shrink-0" style={{ ...size, ...style }}>
      <PixelSprite sprite={sprite.body} tint={bodyColor} className={glow && !dim && !dark ? (evolved ? 'bloom-crimson-shape' : 'bloom-shape') : undefined}
        style={{ position: 'absolute', inset: 0, ...size }} />
      {!dim && (
        <PixelSprite sprite={sprite.seal} tint={INK.volt} className={glow ? 'bloom-volt-shape' : undefined}
          style={{ position: 'absolute', inset: 0, ...size }} />
      )}
      {evolved && !dim && (
        <PixelSprite sprite={evolvedLayer(id)} tint={INK.crimson} className={glow ? 'bloom-crimson-shape' : undefined}
          style={{ position: 'absolute', inset: 0, ...size }} />
      )}
    </div>
  );
};
