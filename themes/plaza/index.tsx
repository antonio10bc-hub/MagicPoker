import { Theme, BoardGeometry } from '../types';
import { Fog, Platform, Prop, Railing, Strip } from '../pieces';
import { BANNER, LAMP } from '@/components/pixel/sprites';
import { FLOOR_TILE, MEANDER_TILE, PAVEMENT_TILE, STONE_FACE_TILE, patternUri } from '@/components/pixel/patterns';
import { CARD_SIZE, INK } from '@/theme/tokens';
import { Nocturne } from '@/components/fx/Nocturne';

// --- ESCENARIO: LADERA NOCTURNA ---
// Un plano de piedra granulado flotando en la noche: suelo pizarra sin dibujo, línea
// de niebla en el centro, barandilla en silueta delante y niebla crema envolviendo
// las bases. Banderolas: las del rival son masas naranjas que brillan; las tuyas,
// siluetas negras. Las farolas son siluetas con un halo naranja (halación).
// Todas las posiciones son relativas a la geometría del tablero, así funciona
// igual en horizontal (ordenador) y en vertical (móvil).

/** Halo cálido de la farola, centrado en el cristal */
const LAMP_GLOW = { x: 5, y: 4, color: 'rgba(255, 74, 28, 0.85)' };

/** Fondo: ladera nocturna con niebla (la plaza flota sobre ella) */
const Backdrop = Nocturne;

const Diorama = ({ board }: { board: BoardGeometry }) => {
  const d = board.diorama;
  const back = d.y + 5;
  const front = board.railing.y + board.railing.h + 5;
  const rowBase = (y: number) => ({ x: d.x + 2, y: y + CARD_SIZE.height - 8, w: d.w - 4, h: 16 });
  return (
    <>
      <Platform
        rect={d}
        rim={board.rim}
        faceHeight={board.faceHeight}
        floor={patternUri('floor', FLOOR_TILE)}
        rimColor={patternUri('pavement', PAVEMENT_TILE)}
        faceTexture={patternUri('stone-face', STONE_FACE_TILE)}
      />
      {/* Niebla a ras de suelo en la base de cada fila */}
      <Fog rect={rowBase(board.slots.opponent[0].y)} strength={0.22} />
      <Fog rect={rowBase(board.slots.player[0].y)} strength={0.32} />
      <Strip rect={board.strip} texture={patternUri('meander', MEANDER_TILE)} />

      {/* Fondo: banderolas del rival y farolas */}
      <Prop sprite={BANNER} owner="opponent" x={d.x + Math.round(d.w * 0.18)} y={back} sway tint={INK.orange} bloom />
      <Prop sprite={BANNER} owner="opponent" x={d.x + Math.round(d.w * 0.78)} y={back} sway tint={INK.orange} bloom />
      <Prop sprite={LAMP} x={d.x - 4} y={back + 1} glow={LAMP_GLOW} tint={INK.black} />
      <Prop sprite={LAMP} x={d.x + d.w - 6} y={back + 1} glow={LAMP_GLOW} tint={INK.black} />

      {/* Delante: barandilla y banderolas del jugador (siluetas) */}
      <Railing x={board.railing.x} y={board.railing.y} w={board.railing.w} h={board.railing.h} />
      <Prop sprite={BANNER} owner="player" x={d.x + 4} y={front} shadow={false} sway tint={INK.black} />
      <Prop sprite={BANNER} owner="player" x={d.x + d.w - 16} y={front} shadow={false} sway tint={INK.black} />
    </>
  );
};

export const plaza: Theme = { id: 'plaza', Backdrop, Diorama };
