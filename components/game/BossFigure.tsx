import { CSSProperties } from 'react';
import { INK } from '@/theme/tokens';
import { PixelSprite, spriteSize } from '@/components/pixel/PixelSprite';
import { auraLayer, BOSS_SPRITES, evolvedLayer } from '@/components/pixel/bosses';

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
  // Evolucionado (en color): halo carmesí que late detrás y aura de píxeles que vibra
  const aura = evolved && glow && !dim && !dark;
  return (
    <div className="relative shrink-0" style={{ ...size, ...style }}>
      {aura && (
        <>
          <div className="absolute pointer-events-none anim-pulse-soft" style={{ left: '-25%', top: '-15%', width: '150%', height: '125%',
            background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255,31,75,0.55) 0%, rgba(255,31,75,0.18) 45%, transparent 70%)' }} />
          <PixelSprite sprite={auraLayer(id)} tint={INK.crimson} className="anim-flicker bloom-crimson-shape" style={{ position: 'absolute', inset: 0, ...size }} />
        </>
      )}
      <PixelSprite sprite={sprite.body} tint={bodyColor} className={glow && !dim && !dark ? (evolved ? 'bloom-crimson-aura' : 'bloom-shape') : undefined}
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
