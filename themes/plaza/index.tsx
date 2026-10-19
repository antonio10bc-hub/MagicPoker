import { Theme, BoardLayout } from '../types';
import { Platform, Prop, Railing, Strip, Surface } from '../pieces';
import { BANNER, LAMP } from '@/components/pixel/sprites';
import { FLOOR_TILE, MEANDER_TILE, PAVEMENT_TILE, STONE_FACE_TILE, patternUri } from '@/components/pixel/patterns';
import { STAGE } from '@/theme/tokens';

// --- ESCENARIO: PLAZA ---
// Una plaza de piedra vista desde arriba: suelo de rombos, greca central,
// barandilla de madera delante, farolas en las esquinas traseras y banderolas
// rojas (rival, al fondo) y verdes (jugador, delante).

const SLOT_X = [92, 144, 196, 248];

const layout: BoardLayout = {
  diorama: { x: 70, y: 24, w: 240, h: 184 },
  slots: {
    opponent: SLOT_X.map(x => ({ x, y: 34 })),
    player: SLOT_X.map(x => ({ x, y: 110 })),
  },
  centerLine: { x: 74, y: 94, w: 232, h: 12 },
};

const Backdrop = () => (
  <Surface rect={{ x: 0, y: 0, w: STAGE.width, h: STAGE.height }} texture={patternUri('pavement', PAVEMENT_TILE)} tileSize={16} color="var(--c-pavement)" />
);

const Diorama = () => {
  const d = layout.diorama;
  return (
    <>
      <Platform
        rect={d}
        floor={patternUri('floor', FLOOR_TILE)}
        rimColor="var(--c-pavement)"
        faceTexture={patternUri('stone-face', STONE_FACE_TILE)}
      />
      <Strip rect={{ x: d.x + 4, y: 96, w: d.w - 8, h: 8 }} texture={patternUri('meander', MEANDER_TILE)} />

      {/* Fondo: banderolas del rival y farolas */}
      <Prop sprite={BANNER} owner="opponent" x={112} y={29} />
      <Prop sprite={BANNER} owner="opponent" x={256} y={29} />
      <Prop sprite={LAMP} x={66} y={30} />
      <Prop sprite={LAMP} x={304} y={30} />

      {/* Delante: barandilla y banderolas del jugador */}
      <Railing x={d.x + 4} y={172} w={d.w - 8} />
      <Prop sprite={BANNER} owner="player" x={74} y={190} shadow={false} />
      <Prop sprite={BANNER} owner="player" x={294} y={190} shadow={false} />
    </>
  );
};

const MenuBackground = () => (
  <>
    <Backdrop />
    <Diorama />
  </>
);

export const plaza: Theme = { id: 'plaza', Backdrop, Diorama, MenuBackground, layout };
