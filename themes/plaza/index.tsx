import { Theme, BoardGeometry } from '../types';
import { Platform, Prop, Railing, Strip, Surface } from '../pieces';
import { BANNER, LAMP } from '@/components/pixel/sprites';
import { FLOOR_TILE, MEANDER_TILE, PAVEMENT_TILE, STONE_FACE_TILE, patternUri } from '@/components/pixel/patterns';

// --- ESCENARIO: PLAZA ---
// Una plaza de piedra vista desde arriba: suelo de rombos, greca central,
// barandilla de madera delante, farolas en las esquinas traseras y banderolas
// rojas (rival, al fondo) y verdes (jugador, delante).
// Todas las posiciones son relativas a la geometría del tablero, así funciona
// igual en horizontal (ordenador) y en vertical (móvil).

const Backdrop = () => (
  <Surface rect={{ x: 0, y: 0, w: 0, h: 0 }} texture={patternUri('pavement', PAVEMENT_TILE)} tileSize={16} color="var(--c-pavement)"
    style={{ width: '100%', height: '100%' }} />
);

const Diorama = ({ board }: { board: BoardGeometry }) => {
  const d = board.diorama;
  const back = d.y + 5;
  const front = board.railing.y + 18;
  return (
    <>
      <Platform
        rect={d}
        rim={board.rim}
        faceHeight={board.faceHeight}
        floor={patternUri('floor', FLOOR_TILE)}
        rimColor="var(--c-pavement)"
        faceTexture={patternUri('stone-face', STONE_FACE_TILE)}
      />
      <Strip rect={board.strip} texture={patternUri('meander', MEANDER_TILE)} />

      {/* Fondo: banderolas del rival y farolas */}
      <Prop sprite={BANNER} owner="opponent" x={d.x + Math.round(d.w * 0.18)} y={back} />
      <Prop sprite={BANNER} owner="opponent" x={d.x + Math.round(d.w * 0.78)} y={back} />
      <Prop sprite={LAMP} x={d.x - 4} y={back + 1} />
      <Prop sprite={LAMP} x={d.x + d.w - 6} y={back + 1} />

      {/* Delante: barandilla y banderolas del jugador */}
      <Railing x={board.railing.x} y={board.railing.y} w={board.railing.w} h={board.railing.h} />
      <Prop sprite={BANNER} owner="player" x={d.x + 4} y={front} shadow={false} />
      <Prop sprite={BANNER} owner="player" x={d.x + d.w - 16} y={front} shadow={false} />
    </>
  );
};

export const plaza: Theme = { id: 'plaza', Backdrop, Diorama };
