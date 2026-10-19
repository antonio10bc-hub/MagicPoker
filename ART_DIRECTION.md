# Dirección de arte — Magic Poker

Fuente de verdad del estilo visual. Cualquier pantalla, carta o escenario nuevo
(mesa, río, ciudad, bosque…) debe cumplir este documento.

**Referencia:** RPG de portátil de doble pantalla, era 2012. Escenarios 2.5D vistos
desde una cámara alta, texturas de baja resolución nítidas, personajes chibi con
contorno, paleta limpia y saturada sobre una base urbana fría. No es pixel art puro:
es baja resolución que *se lee* como pixel art.

**Propiedad intelectual:** solo tomamos el estilo. Ningún personaje, criatura, logo,
símbolo, fuente ni asset de terceros. Todo es original: sprites dibujados a mano en
`components/pixel/sprites.ts`, texturas procedurales en `components/pixel/patterns.ts`
y una fuente libre (Pixelify Sans, licencia OFL).

Los tokens viven en código en `theme/tokens.ts` (TypeScript) y en `app/globals.css`
(variables `--c-*`). Si cambias un valor, cámbialo en los dos.

---

## 1. Cámara y composición

- **Vista cenital inclinada** con proyección casi ortográfica (oblicua): el suelo se ve
  desde arriba y los objetos enseñan su cara frontal.
- **El tablero es un diorama:** una plataforma con grosor (cara superior, cara frontal
  de piedra y sombra proyectada), no una superficie plana.
- **Capas, siempre en este orden:** fondo → plataforma/suelo → objetos del entorno
  (farolas, banderolas, barandilla) → cartas → interfaz → modales → efectos (flash).
- **Mucho aire en el suelo:** el detalle se concentra en los bordes del escenario.

## 2. Resolución y nitidez

- **Dos modos de pantalla** (`theme/layout.ts`, `components/pixel/Stage.tsx`):
  - **Horizontal** (ordenador y móvil en horizontal): escenario fijo de **384×288**
    (`STAGE` en `theme/tokens.ts`).
  - **Vertical** (móvil): ancho interno de ~200–260 px, elegido para que la escala sea
    entera sobre los píxeles físicos, y alto variable que llena la pantalla. Rival
    arriba, tablero en el centro, y la mano y el botón de acción abajo, en la zona del
    pulgar.
- **Escala entera** sobre píxeles físicos (`devicePixelRatio`). Si el entero deja el
  juego por debajo del 80 % del hueco disponible, se usa el ajuste exacto. El sobrante
  se rellena con un letterbox de patrón navy.
- **Ninguna posición está fija en los componentes.** Todo sale de
  `computeGameLayout` / `computeMenuLayout` / `computeBoard` según el tamaño del
  escenario.
- **Sprites en SVG** con `shape-rendering: crispEdges` e `image-rendering: pixelated`.
  Nada de suavizado.
- **Texturas pequeñas (4–16 px)** en mosaico y con bordes duros.
- **Sin degradados suaves.** Si hace falta transición de tono, se hace en 2–4 escalones
  con cortes duros (`repeating-linear-gradient` con paradas duras, nunca fundidos).

## 3. Forma y contorno

- **Contorno de 1 px** (a resolución interna) en cartas, sprites, paneles y botones,
  en **`#1E2638`**. Nunca negro puro.
- **Biseles en todo bloque:** cara superior/izquierda más clara, cara media, y
  sombra inferior/derecha oscura. En CSS se hace con `box-shadow: inset` sin desenfoque.
- **Esquinas redondeadas en píxel:** `.px-round` (1 px) y `.px-round-2` (2 px
  escalonados) con `clip-path`. No se usa `border-radius` en los elementos de interfaz.
- **Detalle repetitivo y ordenado:** juntas de baldosa, greca, balaustres, sillares.

## 4. Luz y sombreado

- **Luz principal desde arriba-izquierda**, igual en todo el juego.
- **Sombreado cel:** base + 1 sombra + 1 brillo (máximo 2 sombras). En los sprites,
  `t/T/u` = base/brillo/sombra del bando.
- **Sombras proyectadas** como manchas semitransparentes (`--c-shadow`,
  `rgba(30,38,56,.35)`) desplazadas **abajo-derecha** (≈ +2/+3 px) bajo cartas,
  objetos y plataforma.
- **Brillos duros y pequeños** en cristal y metal (farolas, gemas de la corona).

## 5. Paleta

| Token | Hex | Uso |
|---|---|---|
| `outline` | `#1E2638` | Contorno, texto |
| `stoneDark` | `#4A4E58` | Piedra oscura, sombras interiores, caras frontales |
| `floor` | `#9AA6AE` | Suelo gris azulado |
| `floorPattern` | `#B8C4CC` | Patrón del suelo, juntas, losas |
| `pavement` | `#D8D4CC` | Pavimento claro, borde de la plataforma |
| `white` | `#F4F4F0` | Blanco cálido: paneles y marcos de carta |
| `glass` | `#4C8CD8` | Cristal; bandas de panel neutras |
| `cyan` | `#7CC8F0` | Brillos, borde interior de panel, huecos seleccionables |
| `navy` | `#2E3A5C` | Iconos, ventanas, insignia de ataque |
| `roof` | `#E85A28` | Acento: dificultad, "resolver" |
| `red` | `#C0281C` | **Bando rival** |
| `green` | `#2E9A3A` | **Bando jugador** |
| `yellow` | `#F0C830` | Interacción: botón principal, selección, valor |
| `wood` | `#D07830` | Madera: barandilla, botas |

Escalones derivados (brillo/sombra): `greenLight #5CC860`, `greenDark #1E6A2A`,
`redLight #E8584A`, `redDark #801810`, `yellowDark #B89010`, `woodDark #985020`,
`skin #F8D0A8`, `skinShade #D8A078`.

**Proporción:** ~70 % neutros fríos (suelo, piedra, blancos), ~20 % azules (cristal,
cian, navy) y ~10 % acentos cálidos. Los acentos solo marcan lo importante: bandos,
interacción y estados.

## 6. Suelos y texturas

- Suelos con **patrón geométrico sutil en dos tonos muy próximos** (rombos, greca,
  ladrillo a matajunta).
- **Juntas de 1 px** visibles, más claras u oscuras que la baldosa.
- Las zonas se diferencian por **patrón y matiz**, no por colores estridentes.
- Todas las texturas son procedurales: una función `(x, y) → color` en
  `components/pixel/patterns.ts`. Se usan como `background-image` con
  `background-size` igual a la baldosa.

## 7. Personajes e ilustraciones

- **Chibi de 2–2,5 cabezas:** cabeza grande, ojos de 1×2 px, silueta legible.
- **Colores planos por zonas**, contorno marino y una sombra.
- Pose frontal. Lienzo de **16×22 px**; ×2 para mascotas en menú y pantalla final.
- **Visten el color de su bando** (`t/T/u`), así una misma figura sirve para los dos.
- Personajes actuales: **K** Rey, **Q** Reina, **J** Príncipe, **A** Sabio con orbe,
  **Joker** Bufón.
- Las cartas numéricas (2–10) usan **pips** (rombo del bando) en disposición de baraja
  clásica.

---

## Aplicación al juego

### Tablero (`themes/<escenario>/`)

- **Diorama** (`Platform`): borde de pavimento con bisel, suelo encastrado con textura,
  cara frontal de sillares y sombra proyectada.
- **Huecos** (`SlotTile` en `components/game/Board.tsx`): losas encastradas, con sombra
  interior arriba-izquierda y brillo abajo-derecha.
- **Bandos:** banderolas rojas al fondo (rival) y verdes delante (jugador), cada una
  con su emblema original (llama / rombo con brote).
- **Franja central** con greca; ahí aparece la cinta "¡PELEA!".

### Cartas (40×56) — `components/game/Card.tsx`

- **Anverso, de arriba abajo:**
  - contorno de 1 px con esquinas de 2 px y marco blanco con bisel;
  - banda de nombre en el color del bando;
  - ventana de ilustración sobre damero blanco/cian, con el chibi o los pips;
  - insignia de **valor** (amarilla) e insignia de **ataque** (navy) con 3 casillas
    (izquierda, frente, derecha): amarillas si golpea todas, cian si elige una al azar
    (J), una estrella para el As y "+2" para el Joker.
- **Dorso:** celosía de rombos en el color del bando sobre navy, con el emblema del
  bando en una placa central.
- **Estados:** nunca se marcan con sombras difusas.
  - **seleccionada:** contorno amarillo/blanco que parpadea en escalones, carta elevada
    6 px y bob de 1 px;
  - **deshabilitada:** desaturada;
  - **dañada:** velo rojo, parpadeo en escalones y sacudida de 1 px;
  - **anulada (As):** escala de grises y velo navy;
  - **sello del atacante:** círculo del bando con su rango.

### Interfaz — `components/pixel/ui.tsx`

- **Panel DS** (`.px-panel`): borde doble (1 px oscuro exterior + 1 px cian interior),
  fondo blanco cálido y banda de cabecera de color (`.px-band`) con texto contorneado.
- **Botón** (`.px-btn`): bisel y 2 px de profundidad que se hunden al pulsar. Tonos:
  `yellow`, `green`, `red`, `blue`, `roof` y blanco.
- **Tipografía:** Pixelify Sans a **10 px** (texto) y **20 px** (títulos), o múltiplos
  (logo a 40 px). El texto claro lleva contorno de 1 px (`.text-outline`).
- **Cuadro de texto** (`TextBox`): aparición letra a letra (28 ms por letra) e
  indicador ▼ parpadeante.
- **Iconos:** sprites de 9×9 en navy (`ICONS`). No se usan librerías de iconos
  vectoriales.

### Movimiento — `theme/tokens.ts` (`steps`, `SNAP_EASE`)

- **Animaciones cortas con "snap":** `ease: steps(n)` o ease-out rápido.
- **Idle:** bob de 1 px en 2 frames (`.anim-bob`); parpadeos con `steps(1)`.
- **Jugar carta:** arco corto (desde abajo el jugador y desde arriba el rival), rebote
  al aterrizar y sombra que crece (250 ms).
- **Robar carta:** entra desde el lado del mazo (derecha) en 5 escalones.
- **Revelar:** volteo horizontal en 3 escalones (100 ms).
- **Impacto:** flash blanco de 2 frames y sacudida de pantalla de 1–2 px (200 ms) al
  resolver el combate.
- **Transición entre pantallas:** persiana en escalones (200 ms al entrar, 150 ms al
  salir).
- **Respeta los tiempos de la lógica** (`TIMINGS` en `lib/constants.ts`): revelar
  300 ms, calcular el combate 500 ms, mostrar el resultado 300 ms y cuenta atrás de
  5 s. Ninguna animación bloquea ni retrasa un evento de juego.
- Con `prefers-reduced-motion` se desactivan los bucles (parpadeos y bob).

---

## Cómo crear un escenario nuevo

1. **Crea la carpeta** `themes/<nombre>/index.tsx`, por ejemplo `themes/rio/`.
2. **Texturas:** añade las baldosas que necesites en `components/pixel/patterns.ts`
   (o en tu carpeta) como funciones `tile(w, h, (x, y) => colorChar)`, usando solo
   caracteres de la paleta. Por ejemplo, agua en 2 tonos de cian/cristal o un puente de
   tablones de madera.
3. **Sprites del entorno:** añádelos en `sprites.ts` o en tu carpeta (árboles, rocas,
   barcas…). Lienzo pequeño, contorno `o`, luz arriba-izquierda y una sola sombra.
4. **Compón el diorama** con las piezas de `themes/pieces.tsx`:
   - `Platform`: suelo, borde, cara frontal y sombra;
   - `Strip`: franjas decorativas;
   - `Railing`: barandillas;
   - `Prop`: objetos con su sombra;
   - `Surface`: cualquier superficie con textura.
5. **Exporta un `Theme`** (`themes/types.ts`) con `Backdrop` (que ocupe el 100 % del
   escenario) y `Diorama({ board })`. El diorama recibe la geometría ya calculada
   (`BoardGeometry`: caja, huecos, franja central y barandilla). Coloca la decoración
   **relativa a esa geometría**, nunca con coordenadas fijas, así sirve tanto en
   horizontal como en vertical. Siempre hay 4 huecos por bando, en orden de índice
   lógico.
6. **Actívalo** cambiando `ACTIVE_THEME` en `themes/index.ts`. No hay que tocar nada más:
   la lógica, las cartas y la interfaz son independientes del escenario.
7. **Comprueba los pilares:**
   - contorno `#1E2638`;
   - luz arriba-izquierda;
   - sombras abajo-derecha;
   - 70/20/10 de color;
   - bandos rojo (fondo) y verde (delante);
   - nada fuera de la rejilla de píxel.
