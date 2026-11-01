import { PixelSprite } from '@/components/pixel/PixelSprite';
import { WISP } from '@/components/pixel/sprites';
import { INK } from '@/theme/tokens';

/** El ente del prólogo, quieto: capa menta, cara en sombra y ojos crema (para paneles) */
export const WispFigure = ({ scale = 1 }: { scale?: number }) => (
  <div className="relative" style={{ filter: 'drop-shadow(0 0 3px rgba(185,207,200,0.5))' }}>
    <PixelSprite sprite={WISP.cloak} tint={INK.mint} scale={scale} />
    <PixelSprite sprite={WISP.face} tint={INK.black} scale={scale} style={{ position: 'absolute', left: 0, top: 0 }} />
    <PixelSprite sprite={WISP.eyes} tint={INK.cream} scale={scale} style={{ position: 'absolute', left: 0, top: 0 }} />
  </div>
);
