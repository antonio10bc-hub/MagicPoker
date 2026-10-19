import { Theme, BoardGeometry } from '../types';
import { Glow, Mat } from '../pieces';
import { FLOOR_TILE, STONE_FACE_TILE, patternUri } from '@/components/pixel/patterns';
import { Nocturne } from '@/components/fx/Nocturne';

// --- ESCENARIO: MESA ---
// Un tapete de juego abstracto flotando en la noche, sin decorado: superficie de grano
// pizarra, un halo cálido en el lado del rival (la amenaza brilla naranja), niebla
// crema en tu lado (la luz contra la que se recortan tus siluetas) y una línea de
// niebla en el centro con una marca romboidal. Todo relativo a la geometría del
// tablero, así sirve igual en horizontal (ordenador) y en vertical (móvil).

/** Fondo: noche con una banda de niebla (el tapete flota sobre ella) */
const Backdrop = Nocturne;

const Diorama = ({ board }: { board: BoardGeometry }) => {
  const d = board.diorama;
  const top = d.h - board.faceHeight;
  const mid = board.strip.y + board.strip.h / 2;
  const s = board.strip;
  return (
    <>
      <Mat rect={d} faceHeight={board.faceHeight} surface={patternUri('floor', FLOOR_TILE)} face={patternUri('stone-face', STONE_FACE_TILE)} />
      {/* Mitad rival: brasa que asoma desde el borde del fondo */}
      <Glow rect={{ x: d.x, y: d.y, w: d.w, h: mid - d.y }} radius={6}
        background="radial-gradient(ellipse 75% 85% at 50% 0%, rgba(255,74,28,0.2) 0%, rgba(242,101,42,0.07) 45%, transparent 75%)" />
      {/* Tu mitad: niebla a ras de suelo desde el borde delantero */}
      <Glow rect={{ x: d.x, y: mid, w: d.w, h: d.y + top - mid }} radius={6}
        background="radial-gradient(ellipse 80% 85% at 50% 100%, rgba(237,235,224,0.22) 0%, rgba(111,143,90,0.06) 50%, transparent 75%)" />
      {/* Línea central de niebla, que se desvanece hacia los lados */}
      <Glow rect={s} radius={s.h}
        background="linear-gradient(90deg, transparent 0%, rgba(185,207,200,0.3) 18%, rgba(237,235,224,0.55) 50%, rgba(185,207,200,0.3) 82%, transparent 100%)" />
      {/* Marca central: rombo de luz */}
      <div className="absolute pointer-events-none" style={{
        left: s.x + s.w / 2 - 4, top: mid - 4, width: 8, height: 8, transform: 'rotate(45deg)',
        background: 'var(--ink-cream)', boxShadow: '0 0 6px 2px rgba(237,235,224,0.35), 0 0 14px 4px rgba(255,74,28,0.18)',
      }} />
      {/* Niebla que envuelve la base del tapete */}
      <Glow rect={{ x: d.x - 20, y: d.y + top - 14, w: d.w + 40, h: board.faceHeight + 34 }}
        background="radial-gradient(ellipse 50% 50% at 50% 45%, rgba(237,235,224,0.4) 0%, rgba(185,207,200,0.18) 45%, rgba(111,143,90,0.05) 70%, transparent 80%)" />
    </>
  );
};

export const mesa: Theme = { id: 'mesa', Backdrop, Diorama };
