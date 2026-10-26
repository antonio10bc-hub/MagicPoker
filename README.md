# Magic Poker

Juego de cartas estratégico (Next.js + React + Zustand + Tailwind + Framer Motion).

El estilo visual está definido en [`ART_DIRECTION.md`](ART_DIRECTION.md).

## Scripts

```bash
npm run dev        # servidor de desarrollo en http://localhost:3000
npm run build      # build de producción
npm test           # tests de la lógica del juego (Vitest)
npm run lint       # ESLint
npm run typecheck  # TypeScript
```

## Estructura

```
app/
  page.tsx              Elige pantalla (menú / partida / final) y controla la música
lib/
  constants.ts          Reglas (vidas, tamaño del tablero, robos), tiempos y colores
  game-utils.ts         Lógica pura: definición de cartas (RANKS), mazo, combate, fin de partida
  ai.ts                 Estrategias del rival por dificultad
  i18n.ts               Textos ES/EN y hook useTranslations (inglés por defecto; español si el navegador
                        está en español o la zona horaria es de España)
  sounds.ts             Efectos y música (con caché y silencio)
  stats.ts              Estadísticas y logros en localStorage
store/
  useGameStore.ts       Estado de la partida y flujo de turnos (temporizadores cancelables)
  useUiStore.ts         Modal abierto (reglas / estadísticas / salir)
theme/
  tokens.ts             Paleta, resolución interna (384×288 de base), tamaños y easings
themes/
  index.ts              ACTIVE_THEME: punto único para cambiar de escenario
  pieces.tsx            Piezas de diorama reutilizables (plataforma, barandilla, props)
  plaza/                Escenario por defecto
components/
  pixel/                Stage (escalado entero), sprites, texturas y UI estilo DS
  screens/              MenuScreen, GameScreen, EndScreen
  game/                 Card, Board, Hud (paneles y mano), GameControls
  modals/               Reglas, estadísticas y confirmación de salida
hooks/                  useMuted
```

### Cómo añadir o cambiar una carta

Todo el comportamiento de un rango vive en `RANKS` (`lib/game-utils.ts`): su valor,
su patrón de ataque (`offsets` relativos a su columna y `mode`), si limpia el tablero, etc.
El combate, la IA y las flechas de la carta leen de ahí, así que basta con tocarlo en un sitio.
