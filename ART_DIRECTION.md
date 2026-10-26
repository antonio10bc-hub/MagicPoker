# Dirección de arte — Magic Poker

Fuente de verdad del estilo visual. Cualquier pantalla, carta o escenario nuevo debe
cumplir este documento. La dirección de arte **solo** toca color, sombreado,
texturas, luz, postprocesado y la estética de sprites e interfaz: mecánicas,
proporciones, zonas de toque, cámara, distribución de la interfaz, tiempos y lógica
(`lib/`, `store/`) no cambian.

## Concepto: impresión analógica nocturna

Mezcla de risografía, serigrafía y película de los 70 forzada, con grano extremo. Una
noche silenciosa y onírica, como un *western* visto con una cámara térmica: siluetas
oscuras y nítidas contra niebla clara, y masas de luz naranja difusa que parecen
brillar desde dentro. Grandes zonas de negro puro como espacio negativo.

**Propiedad intelectual:** todo es original: sprites en `components/pixel/sprites.ts`,
texturas procedurales en `components/pixel/patterns.ts` y fuentes libres (OFL):
**Special Elite** (máquina de escribir) para el texto y **Bebas Neue** (condensada)
para cifras y títulos.

Las tintas viven en `theme/tokens.ts` (`INK`, y `PALETTE`/`TEAM` como roles) y en
`app/globals.css` (`--ink-*`, y `--c-*` como roles). Si cambias un valor, cámbialo en
los dos.

---

## 1. Paleta (cerrada: no se añaden colores)

| Tinta | Hex | Uso |
| --- | --- | --- |
| Negro profundo | `#0B0D0C` | fondos, cielo, vacío, siluetas. **Dominante** |
| Pizarra verdoso | `#1E2A28` | cuerpos de tus cartas, paneles, huecos |
| Teal apagado | `#5E7A76` | terreno, superficies, ladera |
| Menta pálido | `#B9CFC8` | niebla media, brillos fríos, selección neutra |
| Crema luminoso | `#EDEBE0` | niebla, polvo, luz, texto |
| Bermellón | `#FF4A1C` | **acento**: rival, peligro, objetivos, vidas |
| Brasa | `#F2652A` | acento secundario: interacción, núcleos de luz |
| Musgo | `#6F8F5A` | solo transición en halos (niebla, pelea) |
| Voltio | `#7DFF2B` | **exclusivo de los sellos**: verde eléctrico (amarillo verdoso) que brilla como el naranja |
| Carmesí | `#FF1F4B` | **exclusivo del Castillo**: rojo eléctrico de los jefes evolucionados, su página y sus mejoras |
| Oro | `#E8B64A` | el Soberano (dorso, aura), lo **legendario** (cartas, rareza, cofre) |
| Azul eléctrico | `#2E9BFF` | **exclusivo del mercader del Castillo** y de todo lo que sale de él |
| Ámbar | `#FFC233` | **exclusivo del Bosque** (su botón, su título, los ojos que te miran, el bestiario) |

**El naranja es el único color saturado y se reserva para lo importante.** Nunca hay
dos fuentes de color compitiendo: el decorado es negro y grises fríos.

### Reglas por tipo de asset

- **Siluetas (sólidos):** casi negras, borde limpio, sin detalle interno, lectura por
  contorno. Personajes de las cartas, mascotas, iconos.
  En código: `PixelSprite` con `tint` (un solo color para todo el sprite).
- **Masas vivas (energía, interacción, rival):** naranja con *bloom* (`.bloom`), halo
  suave y bordes que se deshacen (máscara radial). Cartas del rival, vidas, botones
  de acción, avisos, números de golpe, "¡PELEA!".
- **Escenario: un tapete abstracto**, sin ciudad ni decorado. Plano inclinado de grano
  estocástico (pizarra con puntos negros y teal), sin dibujo ni baldosas.
- **Niebla:** crema/menta a ras de suelo; sube desde tu borde del tapete y envuelve su
  base. Es la luz contra la que se recortan tus siluetas. En el borde del rival asoma
  un halo de brasa.
- **Sombras:** largas, oscuras y difusas, alejándose de la luz (abajo-derecha).
- **Prohibido:** contornos, *cel shading*, brillos especulares, degradados limpios
  sin grano, colores saturados que no sean el naranja, cielos con estrellas o nubes,
  estética *cartoon*.

### Jerarquía de lectura

- **Tú:** silueta oscura (pizarra) con niebla crema detrás. Tus flechas son de luz
  crema.
- **El rival, los objetivos, los peligros y las recompensas:** masas naranjas que
  brillan. Sus flechas, naranjas con halación.
- **Fondo y decorado:** negro y grises fríos.
- Todo lo interactivo se distingue de un vistazo: o es crema sobre negro, o es naranja.

## 2. Postprocesado

Se aplica sin *shaders* WebGL, con capas baratas de composición:

- **Grano** (`components/fx/FilmGrain.tsx`): un mosaico de ruido a resolución de
  pantalla (1 punto = 1 px CSS, no un píxel interno) que salta a 4 desplazamientos a
  ~8 fps (*boil* lento) con un `transform` que hace el compositor.
  - Capa `overlay` al 60 %: grano de luminancia con colas largas. Convierte todo
    degradado en densidad de puntos.
  - Capa normal: motas sueltas crema, naranja, teal y menta, que también salpican el
    negro puro (el overlay no lo aclara).
- **Bloom y halación:** en cajas (cartas, botones, avisos) es un `box-shadow` doble:
  halo cercano intenso y otro amplio rojizo, como la halación de la película
  (`.bloom`). En siluetas pequeñas, un único `drop-shadow` (`.bloom-shape`,
  `.bloom-cream`); en texto, `text-shadow` (`.glow-text`).
- **Desajuste de registro / aberración mínima:** el texto lleva dos sombras
  desplazadas medio píxel (naranja a un lado, teal al otro), como dos tintas que no
  casan (`.text-outline`, logo).
- **Ghosting:** desenfoque animado en lo que se mueve rápido (cartas que vuelan,
  cartel de ronda, cinta de pelea).
- **Viñeta** (`.vignette`): oscurece suavemente los bordes.
- **Fondo** (`components/fx/Nocturne.tsx`): noche con una banda de niebla detrás del
  tapete, con tramado estocástico (cada píxel elige tinta por luminancia + umbral
  aleatorio; el 10 % de los umbrales se renueva en cada fotograma), a media resolución
  interna y escalada con suavizado para que los puntos se fundan como tinta. En la
  pelea la niebla se calienta: brasas naranjas con transición musgo.

### Rendimiento (móvil primero)

- **Bucles infinitos en CSS, nunca en JavaScript:** balanceo de la mano y de la mesa,
  latidos, pulsos, letras que ondulan, rayos… (`.anim-*` en `globals.css`). Solo
  `transform` y `opacity`, y **sin `var()` dentro de los keyframes** (lo saca del
  compositor). framer-motion queda para transiciones puntuales (entrar, salir, volar,
  embestir).
- **Nada de `filter` ni `backdrop-filter` en superficies grandes o que se animen.** El
  desenfoque de *ghosting* se quita (`filter: none`) en cuanto la carta aterriza.
- **SVG de las flechas estático:** cualquier cambio dentro obliga a recalcular sus
  desenfoques en cada fotograma.
- **El fondo** se calcula a media resolución, a 8 fps y con lo estático precalculado.
- Referencia medida (móvil simulado, CPU ×4 más lenta): de ~22 fps a ~55 fps; el
  JavaScript por segundo bajó de ~450 ms a ~60 ms.

Si en el futuro se pasa a WebGL, el *shader* equivalente sería: grano (ruido azul
animado a 8 fps, mezcla overlay) → umbral de brillo sobre naranjas y cremas → dos
desenfoques gaussianos (bloom cercano y halación amplia teñida de rojo) → desfase de
canales de 0,5 px → viñeta.

## 3. Cámara y composición (sin cambios)

- Vista cenital inclinada; el tablero es un tapete con canto y sombra.
- **Capas:** fondo → tapete → luces y niebla → cartas → interfaz → modales → flash →
  viñeta → grano.
- Mucho aire: el negro es espacio negativo.

## 4. Resolución

- La maquetación sigue en píxeles internos escalados por enteros, así que **posiciones
  y tamaños no cambian**. En vertical, ancho ~180–300. En horizontal (ordenador), alto
  ~260–330 y el ancho sigue la proporción de la pantalla (de 384 en 4:3 hasta 576,
  ~2:1): el juego llena el monitor sin franjas negras. Las distribuciones se calculan
  a partir de ese ancho y alto (`theme/layout.ts`), nunca con coordenadas fijas.
- **Horizontal panorámico (≥440 de ancho):** columnas laterales de 84 (cabe el nombre
  del jefe), botones de partida de 18, mano a tamaño real y PLANTARSE a la altura de
  la mano. La pantalla final centra su tapete en toda la pantalla. Esc cierra las
  ventanas que se cierran tocando fuera.
- **Ultrapanorámico (hasta 32:9):** el escenario llega hasta 1100 de ancho; la partida
  agrupa mesa y columnas en una zona central de 600 como mucho y el fondo llena el
  resto.
- **Cara o cruz:** al empezar una partida (tras la presentación del jefe) la mesa se
  desenfoca y en el centro se lanza una moneda: cara crema con tu corazón (empiezas
  tú), cruz naranja con la silueta del rival (empieza él). Sube girando, cae, se lee
  "¡CARA!/¡CRUZ!" y quién empieza; la ronda no arranca hasta que tocas ("Toca para
  empezar" late debajo; en el ordenador, también Intro o Espacio). La moneda sale una
  vez por duelo: después abre cada ronda quien va ganando (más parte de sus vidas en
  pie) y, si van igual, quien abrió la anterior. El cartel de ronda dice "EMPIEZA EL
  RIVAL" cuando le toca abrir a él.
- Lo que se pinta ya no es *pixel art* nítido: texturas de grano fundidas con un leve
  desenfoque, grano fino a resolución de pantalla encima y fuentes vectoriales.

---

## Aplicación al juego (lista de assets)

| Asset | Antes | Ahora |
| --- | --- | --- |
| Fondo (`Backdrop`) | remolino psicodélico azul/rojo | noche con niebla punteada; brasas en la pelea |
| Capa final | CRT con líneas de barrido | grano de película + viñeta |
| Escenario (`themes/mesa`) | plaza de ciudad con farolas, banderolas y barandilla | tapete abstracto de grano: halo de brasa del lado rival, niebla en el tuyo, sombra larga |
| Suelo | baldosas con rombos | grano estocástico sin dibujo |
| Franja central | greca | línea de niebla que se desvanece hacia los lados, con un rombo de luz |
| Farolas, banderolas, barandilla | decorado de la plaza | eliminados |
| Huecos | losas claras con bisel | rebajes oscuros; se iluminan de niebla si puedes jugar |
| Tus cartas | marco verde, damero cian, chibi a color | cuerpo pizarra, ventana de niebla crema, personaje en silueta, cifra negra |
| Cartas rivales | marco rojo | masa naranja con bloom y núcleo encendido |
| Dorsos | celosía de rombos con emblema | grano del color del bando con bordes que se deshacen, emblema en silueta |
| Insignias | amarilla / navy con contorno | píldoras negras, cifra crema, casillas de ataque brasa o menta |
| Flechas | verde / roja con borde | luz crema (tú) / naranja con halación (rival), sin contorno |
| Avisos | badges de color con contorno | masas de luz con la marca en silueta |
| Paneles | oscuros con canto inferior | negro semitransparente con leve desenfoque detrás, sin bordes |
| Botones | color plano con canto | naranja con bloom y texto en silueta; secundarios negros |
| Vidas | corazones rojos con brillo | brasas naranjas con bloom; perdidas, en pizarra |
| Iconos | navy con detalle | siluetas crema planas |
| Tipografía | Pixelify Sans | Special Elite (texto) + Bebas Neue (cifras y títulos) |
| Partículas | cuadrados con contorno | polvo granulado redondo |
| Ondas | anillos nítidos | halos difusos |
| Logo | amarillo/blanco con contorno grueso | naranja con bloom / crema, con desajuste de registro |
| Mascotas del menú | chibis a color | silueta negra (tú) / masa naranja (rival) |
| Final | rayos dorados, confeti | rayos naranjas difusos, polvo que cae |

### Lectura de la partida (claridad ante todo)

- **Cartas:** las numéricas muestran la cifra grande en el centro (34 px, condensada,
  en silueta negra sobre la luz). Las figuras llevan el rango (20 px) en la esquina,
  y la insignia de valor es una píldora negra con la cifra crema.
- **Avisos del tablero** (`components/game/BoardHints.tsx`). Solo usan información
  visible, nunca las cartas boca abajo del rival:
  - **hueco tuyo vacío:** corazón menta tenue (si lo golpean pierdes una vida); con
    amenaza de una carta rival, el hueco se calienta en naranja y late un "!". Una
    carta rival destapada amenaza solo los huecos de su patrón (la Reina, en diagonal;
    As y Joker, ninguno); una boca abajo, el hueco que tiene delante;
  - **flechas de ataque** (`components/game/AttackArrows.tsx`):
    - **a demanda:** tocar una carta de la mesa enciende sus flechas (brilla en el
      color de su bando) y volver a tocarla las apaga; se pueden encender varias a la
      vez, tuyas o rivales destapadas (las boca abajo no responden). La carta que estás colocando siempre muestra las
      suyas como vista previa;
    - **forma:** cada carta dibuja una cuña translúcida (fina al salir, ancha en la
      punta) con un leve arco hacia cada hueco que golpeará, hecha de **luz del
      bando**: crema la tuya, naranja con halación la del rival. Sin contorno;
    - **cruces:** cada flecha se curva siempre hacia su derecha, así que dos flechas que
      se cruzan forman una "X" clara;
    - **mismo hueco:** si varias apuntan al mismo, sus puntas se abren en abanico;
    - **de frente:** si dos cartas se atacan cara a cara, la que pierde dibuja una
      flecha diminuta (corta y estrecha) frente a la grande de la que gana; si empatan,
      ambas se quedan a mitad de camino y chocan con un destello;
    - **el rival:** muestra flechas solo con las cartas destapadas;
    - **casos especiales:** el Príncipe dibuja flechas discontinuas y tenues; el As, una
      onda;
    - **al resolverse la pelea:** las flechas se ven `ARROW_HOLD_S` (0,6 s) y
      desaparecen antes de las embestidas. El choque visual se retrasa ese tiempo, pero
      la lógica no cambia;
  - **"-N" naranja** en los huecos rivales vacíos a los que apuntan tus cartas con las
    flechas encendidas (daño seguro, se suma si coinciden varias);
  - **antes del golpe**, con todo destapado: ✓ crema en las cartas rivales que caerán
    y ✗ naranja en las tuyas.
- **Ayudas de decisión** (`components/game/forecast.ts`, solo información visible):
  - **patrón al seleccionar:** con una carta elegida, cada hueco libre dibuja sus tres
    flechas (diagonal, frente, diagonal) encendidas según golpee; discontinuas si es al
    azar; estrella para el As y "+2" para el Joker;
  - **¿te plantas?:** antes de plantarte se ve el daño seguro que haces y a cuánto te
    expones (las cartas ocultas del rival cuentan como posibles). "No volver a
    mostrar" la apaga; se recupera en Ajustes → Confirmar al plantarse;
  - **vida en peligro:** junto a tus vidas, "-N" con los golpes que pueden llegarte; si
    bastan para acabar contigo, late "¡PELIGRO!";
  - **mazo:** tocar tu mazo muestra cuántas cartas de cada rango te quedan (sin orden);
  - **leyenda:** sección 5 de "Cómo jugar", con los mismos iconos de la partida.
- **Carteles sin tapar la acción:** "¡PELEA!" dura 0,7 s y se va antes de que las
  cartas embistan; "RONDA" pasa en 1,1 s sobre la franja central.
- **Ficha de carta:** mantener pulsada una carta (o dejar el ratón encima) la abre.
- **Arrastrar y soltar:** al arrastrar, la carta sigue al dedo 1:1 y se ajusta al
  tamaño de la mesa. El destino es el hueco libre más cercano al centro de la carta
  (con margen generoso alrededor de cada hueco); se confirma con la vista previa, un
  marco naranja que late, un clic y una vibración breve.
- **Móvil en vertical:**
  - escala ×6 en los móviles habituales (ancho interno ~180–195 px);
  - tapete compacto que crece para llenar el hueco libre: primero se ensancha el
    centro (entre bandos, donde pasan los carteles) y luego los bordes;
  - mano a ×1,5 si cabe (sigue cayendo en píxeles enteros).

### Movimiento y game feel

- **Golpe decisivo a cámara lenta:** la pelea que deja a alguien sin vidas se vive
  más despacio: color apagado con viñeta (sin bandas de cine, que tapaban la mano), zoom lento al
  choque (2,4 s), la música se hunde y late un corazón grave; el impacto retumba más
  (destello, sacudida y vibración fuertes). Las animaciones de las cartas no se
  ralentizan (el reloj de Framer no se toca).
- **Daño con peso:** al perder vidas salta un "-N" sobre los corazones (carmesí si son
  tuyas) y, si son tuyas, los bordes de la pantalla laten en rojo. El jefe del panel
  se encoge y se enciende al recibir.
- **Reacciones del jefe:** bocadillo tras la pelea si le robas una carta, le devuelves
  un golpe con el espejo, le borras la mesa con un As, le quitas 2 vidas o le tumbas 2
  cartas, o se ríe si te quita 2 vidas.
- **Los avisos esperan a las cinemáticas** (presentación del jefe, fase 2), igual que
  a las ventanas.

El movimiento es suave: muelles (`type: 'spring'`) y curvas ease. **Los tiempos no
cambiaron con la dirección analógica**; solo se añadió *ghosting* (desenfoque) a lo que
se mueve rápido y una vibración leve a las masas naranjas.

- **Cámara 3D** (`components/game/Board.tsx`):
  - el tablero es un único plano inclinado en perspectiva (14°, 20° durante la pelea);
  - **no se usa `preserve-3d` dentro del tablero**, porque rompe el orden de clic entre
    elementos coplanarios;
- **Cámara de impacto** (`components/fx/fxStore.ts`): sacudida con amortiguación,
  "punch" de zoom y flash crema. La intensidad escala con lo que pasa en pantalla.
- **Cartas:**
  - volteo real en 3D (rotateY, dos caras con `backface-visibility`);
  - al jugarse aparecen sobre su propio hueco, caen un poco, se aplastan al aterrizar
    y levantan polvo. No vuelan desde la mano: un vuelo dentro del tablero inclinado
    en 3D se pinta mal en Safari de iOS (la carta salía diminuta en una esquina);
  - en la pelea embisten hacia su objetivo y el golpe llega `IMPACT_DELAY_S` después;
  - al morir se agrietan, sueltan esquirlas y caen al retirarse.
- **Mano:**
  - abanico con rotación y arco;
  - al pasar el ratón la carta se eleva y se inclina en 3D siguiendo el puntero;
  - las cartas robadas llegan una tras otra desde el mazo.
- **Partículas, textos flotantes y ondas de choque** (`components/fx/FxLayer.tsx`), en
  la capa del tablero o de la interfaz. Las partículas son polvo granulado (motas
  redondas y blandas), las ondas son halos difusos y los números de golpe, masas
  naranjas con la cifra en silueta.
- **Cámara de pelea** (`fx.focus`, capa propia en `Stage`): mientras se ven las
  flechas se acerca (×1,08–1,14) a donde va a pasar algo —cartas que caen, golpes
  directos o el As— y se suelta tras el impacto.
- **Vibración con significado** (`haptic()` en `lib/sounds.ts`): toque seco al
  seleccionar o pasar por un hueco, golpe al colocar, doble golpe al ganar un choque,
  golpe largo al perder carta o vida, redoble en el barrido del As, aviso de peligro,
  fanfarria al ganar. Respeta el ajuste de vibración.
- **Música generativa** (`lib/music.ts`): western nocturno en cinta, sin archivos.
  Bordón grave que respira y sigue una progresión lenta (La–Fa–Sol–Mi), guitarra con
  trémolo y reverb en escala frigia con silencios largos, pulso sordo en partida y
  siseo, saturación y temblor de cinta. En la pelea se tensa: pulso más rápido,
  segunda menor en el bordón y filtro más abierto.
- **Coreografía** (`components/game/CombatDirector.tsx`): escucha los estados de la
  lógica (fase y resultado del combate) y dispara sonido, partículas y cámara. **Nunca
  cambia tiempos ni el orden de los eventos de juego.**
- **Ambiente:**
  - motas de polvo que suben;
  - niebla de fondo que se arrastra y hierve;
  - personajes que respiran y saltan;
  - cámara del menú que se mece.
- **Interfaz:**
  - botones con muelle (crecen al pasar, se aplastan al pulsar);
  - cartel "RONDA N" que barre la pantalla (borroso al moverse) al empezar cada ronda;
  - cinta "¡PELEA!": una masa naranja que entra de golpe;
  - corazones (brasas) que salen despedidos al perder una vida, y viñeta naranja con
    latido cuando te queda una.
- **Transiciones entre pantallas:** iris circular con un leve zoom.
- Con `prefers-reduced-motion` se desactivan los bucles CSS.

### Sonido (`lib/sounds.ts`, `lib/synth.ts`, `lib/music.ts`)

- **Música que crece:** con 2 vidas (de cualquiera) la música de partida se tensa a
  medias; con 1, o contra el Soberano en su fase 2, a tope: el pulso se acelera, late
  doble (pum-pum) y entra una cuerda aguda con trémolo rápido.

- **Motor Web Audio:** música generativa con fundido entre estilos; paso bajo que
  "ahoga" la música con un modal abierto; *ducking* en los golpes fuertes; volúmenes
  de música y efectos desde Ajustes.
- **Efectos con la misma paleta que la música** (western nocturno en cinta), sin
  archivos salvo barajar (`shuffle.mp3`). Todo pasa por filtros paso bajo y una sala
  con reverb compartida; las notas están en La frigio, como la música:
  - interfaz: roce y toque de madera (`hover`, `tick`), roce de tela (`open`);
  - cartas: cuerda punteada que sube / baja al seleccionar (`select`, `deselect`),
    papel (`draw`), aire (`whoosh`), golpe blando en el tapete (`place`), cartulina
    (`flip`);
  - pelea: dos golpes de tambor y cuerda grave con trémolo (`fight`), viento
    (`swing`), madera hueca (`hit`), bombo y desmoronarse (`crush`), cuerda que se
    dobla hacia abajo en el golpe directo (`zap`), aspiración + golpe + campanas
    para el As (`wipe`, `reveal`);
  - vidas: díada disonante La–Si♭ (`hurt`), quinta limpia con campana (`score`),
    latido (`heartbeat`);
  - ronda: campana lejana (`turn`); premio: campanitas y fichas (`sparkle`, `pop`);
  - final: frase de guitarra que sube (`victory`) o la caída frigia hasta el Si♭
    (`defeat`).
  Cada reproducción lleva una ligera variación de tono para que no canse.
- **Vibración** con significado (ver "Movimiento y game feel").

### Sellos y bosses

- **El Soberano (batalla final) tiene dos mazos:** uno de póker y otro con todos sus
  sellos. Empieza con 3 cartas y 1 sello, y cada ronda roba una carta de póker y un
  sello, así siempre tiene algo que poner y un sello con el que adornarlo. El contador
  de su mazo en el panel suma los dos.
- **El As del rival:** no se carga su propia mesa cuando va claramente por delante
  (más de 6 puntos de fuerza: valor de las cartas y 4 por sello); con poca ventaja lo
  usa a veces (25 %); parejos o perdiendo, lo usa. Si solo le queda el As y no le
  compensa, se planta y lo guarda.

- **Todo lo relacionado con los sellos es verde eléctrico** (`--ink-volt`, `.bloom-volt`,
  `.glow-volt`): las cartas de sello, la insignia del sello puesto en una carta, los
  contornos de objetivo al aplicarlo, los efectos de pelea y la colección.
- **Carta de sello:** masa verde con el icono del sello en silueta negra y su nombre
  (DEFENSA, ATAQUE, CAMBIO, ROBO, VIDA). Se suelta sobre una carta tuya sin sello.
- **Sello puesto:** la carta entera se tiñe de verde voltio (cuerpo, ventana y dorso,
  también boca abajo) y lleva la insignia redonda verde en la esquina. Los del rival se
  ven. Cuando el sello se rompe, la carta vuelve a su color.
- **Efectos en la pelea:** cada sello se ve actuar.
  - CAMBIO: la carta se desliza a su nuevo hueco con estela verde.
  - ¡ROBO!: las dos cartas se cruzan en arco, brillando.
  - Ataque (x2): doble embestida, con dos impactos verdes en el objetivo.
  - Defensa: una burbuja verde se levanta, encaja el golpe (aplasta y rebota, chispas
    hacia el atacante, "¡BLOQUEO!") y luego estalla en pedazos.
  - Vida: "+1 VIDA" y chispas que suben; el corazón recuperado entra en verde.
  - Espejo: una franja de luz cruza la carta, "¡ESPEJO!" y un rayo de chispas hasta el
    atacante, que cae.
  - Veneno: "¡VENENO!" y vapor verde que sube de la carta que cae envenenada.
  - Eco: "ECO → 2" con ondas verdes; al seguir, un 2 cae en el hueco.
  - Ancla: "¡ANCLADA!" con un golpe seco y polvo verde; la carta no se mueve.
  - Revelar: "¡TE VEO!", la carta rival se da la vuelta y lleva un ojo brasa en la
    esquina; su valor se enciende en brasa con uno menos.
- **Bosses** (`components/pixel/bosses.ts`, `components/game/BossFigure.tsx`): siluetas
  grandes en naranja con su sello en verde como objeto (escudo, amuleto, anillo,
  colgante, corazón). Su forma cuenta su sello: El Muro (defensa) es enorme y fuerte,
  La Duelista (ataque) lleva dos espadas, El Trilero (cambio) tiene un anillo girando,
  La Ladrona (robo) va agachada con un saco, La Matriarca (vida) lleva un bastón con
  un corazón, El Espejista (espejo) lleva gorguera y un espejo de mano, La Tóxica
  (veneno) una capucha y un frasco que gotea, El Bardo (eco) un laúd y ondas, El
  Marinero (ancla) un ancla al hombro y La Vidente (revelar) una bola con un ojo. El
  Forastero, el primero, no tiene sello. El Soberano, jefe secreto, es enorme, con
  corona de gemas verdes y un cinturón de sellos: lleva todos.
- **Bocadillo del boss:** al empezar cada ronda dice una frase con su personalidad en
  un bocadillo crema con contorno negro junto a su panel (entrada, perdiendo,
  ganando o una de las de siempre).
- **Menú:** el boss a derrotar, grande sobre el tapete y respirando; la lista se
  desliza en horizontal (con imán y puntos de página): los vencidos llevan sus
  estrellas y los futuros salen apagados y sin nombre. Un solo botón: ¡DESAFIAR!
  contra un jefe que aún no has vencido (con uno bloqueado se apaga) y REVANCHA
  ("nivel N" en pequeño) contra uno vencido; debajo, la pista de en qué se hace más
  fuerte. El jefe secreto no sale en la lista hasta que has vencido a los demás.
- **Editor de mazo:** llega con el primer sello (al vencer al segundo boss): botón
  naranja con un mazo en el menú. Arriba, las 14 cartas del mazo (se pueden quitar
  hasta 3, tachadas); debajo, los sellos desbloqueados (hasta 5 en total, 2 copias de
  cada uno). Un sello nuevo entra solo en el mazo si aún cabe.
- **En partida:** la silueta del boss (negra sobre la banda naranja) en el panel del
  rival, con tantos corazones como vidas tenga (algunos tienen 5).
- **Desbloqueo:** al vencer a un boss, su sello se estampa en verde en el centro antes
  que los logros. El primero desbloquea la colección (botón verde en el menú).
- **Orden de los avisos:** sello de carta > logros > panel de final de partida. Cada
  uno espera a que se cierre el anterior, y ninguno sale mientras se ve la pelea
  (ni durante el repaso del resultado).
- **Presentación del jefe:** al empezar una partida nueva el jefe cae a pantalla
  completa sobre un fondo oscuro: silueta grande que aplasta el suelo, una raya del
  color del modo (naranja; verde en revancha; carmesí en el Castillo), su nombre, sus
  vidas, sus sellos y su frase de entrada en el bocadillo crema.
- **Revanchas:** cada revancha ganada sube el nivel del jefe (NV.1 a NV.4: más vidas
  y más sellos). En la lista, cada jefe vencido lleva 5 estrellas pequeñas, sin texto:
  encendidas en naranja las victorias, apagadas en pizarra el resto; con las 5,
  todas doradas.
- **Dorsos:** cada jefe tiene un dorso temático, como un dorso de baraja impreso: el
  grano del color del bando (bajado) con líneas finas encima (marco doble y una figura
  geométrica: rombo, círculos, galones o rayos, según el jefe), su silueta en negro en
  el centro y su sello en la esquina. Sus cartas lo usan siempre; tú lo ganas con 5
  victorias contra él y te lo pones en la colección (pestaña Dorsos). El del jefe
  secreto es especial: oro con rayos, un aura crema grande, la silueta más grande en
  el centro exacto y una estrella arriba y otra abajo.
- **Colección:** ventana más estrecha (250 px) y todo en letra pequeña: sellos con
  icono de 16 px; dorsos en rejilla de 5 a escala reducida, sin nombre (el puesto
  lleva contorno crema; los que aún no son tuyos, 5 puntitos con las victorias).
- **Música y sonido:** cada jefe tiene su variación del tema de partida (tono, tempo,
  timbre y trémolo); en el Castillo, más grave, más rápida y siempre tensa. Cada sello
  suena a lo suyo al ponerlo y al actuar (cristal el espejo, campana que se repite el
  eco, cadena y hierro el ancla, burbujeo el veneno…).

### El Castillo

- **Rojo eléctrico (`--ink-crimson`)** marca todo lo del Castillo: su página al final
  de la lista de jefes (un castillo de torres en punta), el botón ENTRAR / SEGUIR, el
  piso (n/12) en el panel del rival y la presentación.
- **Jefes evolucionados:** la misma silueta con una capa carmesí sacada de ella
  (ojos encendidos, púas por arriba y a los lados) y su aura: halo carmesí doble en la
  silueta (cerca intenso, lejos suave), un aura de píxeles punteada a dos píxeles del
  contorno que parpadea, chispas sueltas por encima y un resplandor carmesí que late
  detrás. En miniatura negra (panel compacto del rival) no lleva aura.
- **El Soberano evolucionado** lleva mucha más aura, roja y dorada: además de la
  roja, un segundo aura de píxeles en oro (más lejos del contorno, latiendo), un
  tercer anillo de chispas carmesí, un resplandor dorado amplio y, en grande, una
  corona de rayos oro y carmesí que gira detrás. En su evolución la mitad de las
  brasas son de oro.
- **Entre pisos (pequeña cinemática, sin panel de victoria):** cada animación dura
  0,5 s más que una normal del juego, para que se saboree.
  1. *Jefe derrotado:* sobre negro con un halo carmesí, el jefe evolucionado tiembla,
     destella dos veces y se desmorona hacia abajo en esquirlas carmesí; debajo,
     "DERROTADO" en carmesí y "Piso N superado" en pequeño. Tocar lo salta.
  2. *El mercader (azul eléctrico, `--ink-azure`):* el halo pasa de rojo a azul, se
     enciende el farol (parpadeo de llama) y el mercader sale despacio de la oscuridad
     (encapuchado, con un fardo a la espalda; cuerpo azul, ojos y farol crema). Todo
     pequeño y en penumbra, con rollo misterioso: su nombre en letra pequeña espaciada,
     su frase entre comillas en menta (sin bocadillo) y sus 3 mejoras en filas
     compactas (8 px, contorno azul tenue, icono en azul). No se puede elegir ninguna
     hasta que han entrado las 3: un toque rápido no coge nada a ciegas. "Volver al menú" en
     fantasma; al volver, la ventana del mercader (banda azul) te espera.
  3. *Nuevo jefe:* al elegir, el mercader se desvanece y el siguiente jefe cae en su
     forma normal en la presentación; ahí mismo evoluciona: tiembla, se hincha con un
     destello blanco, estalla un halo carmesí con una onda de choque (anillo que se
     abre), le sale su capa roja con el aura y suben brasas carmesí por los lados
     mientras dura la presentación. En el Castillo la presentación no se va sola:
     se queda hasta que tocas (sin texto que lo pida; los toques antes de que acabe
     de evolucionar no cuentan).
- **Todo lo que sale del mercader es azul eléctrico:** las cartas nuevas (masa azul en
  vez de pizarra, ventana bañada en azul; el comodín, azul en vez de verde), la
  insignia de valor de las cartas mejoradas (+2), un filo azul en las que ha sellado
  (el verde del sello manda) y las vidas de más por encima de las 4 de partida.
- **Resumen de la subida:** al conquistar o caer, la pantalla final del Castillo lleva
  el botón RESUMEN (naranja, bajo ¡OTRA SUBIDA!), y el Castillo del mapa un botón
  redondo (i) arriba a su derecha. Ventana grande de banda carmesí: cómo
  acabó (¡CASTILLO CONQUISTADO! en oro o "Caíste en el piso n" en carmesí), el mapa,
  los desafíos en pastillas carmesí, las estadísticas (pisos, peleas, tiempo, vidas
  quitadas y perdidas, cartas tumbadas y perdidas, mejor pelea, mejoras por rareza en
  sus colores y cofres; una columna en vertical, dos en horizontal) y el mazo final
  en miniaturas con las vidas con las que acabaste.
- **Vidas y mazo en el mercader:** bajo el mapa, una fila con tus corazones (los de
  más que dio el mercader, en azul) y el botón "MAZO · n" (contorno azul). Al tocarlo se
  despliega tu mazo en miniaturas de 16×21 ordenadas (normales por valor, del Castillo,
  sellos): número o silueta, puntito verde si lleva sello, "+N" azul si está mejorada,
  filo azul si vino del mercader, oro si es legendaria. Se cierra tocándolo. También en
  la ventana del mercader al volver del menú.
- **Rarezas del mercader:** cada mejora lleva su rareza en pequeño a la derecha de su
  título: COMÚN (menta), RARA (azul, contorno más vivo) y LEGENDARIA (oro: contorno y
  título dorados, icono en oro y un brillo que cruza la fila). Las legendarias salen a
  partir del piso 6.
- **Cartas legendarias** (Dragón, Hidra, Fénix): cuerpo azul del mercader con un filo de
  oro doble, halo dorado y una estrella de oro en la esquina superior derecha.
- **Cofre (pisos 3, 6 y 9):** entre el jefe derrotado y el mercader. Cofre de madera
  carmesí con herrajes de oro sobre un halo tenue que late; "Toca para abrirlo". Al
  tocar tiembla cada vez más y su luz sube de rareza en rareza (menta → azul → oro)
  hasta pararse en la suya; la tapa salta, sale un haz de ese color y el premio sube
  grande. Debajo, su rareza, título y descripción, y "Seguir". Si vuelves al menú con
  el cofre cerrado, lo abres en la ventana del cofre (banda carmesí).
- **Mapa de la subida:** fila de 12 pisos (cuadraditos de 6 px): vencidos en carmesí,
  el actual con anillo que late, los que faltan apagados; un cofrecito de oro entre
  los pisos 3-4, 6-7 y 9-10 (apagado si ya se abrió) y una estrella para el Soberano.
  Sale arriba en la escena del mercader (el piso recién vencido se rellena) y en la
  página del Castillo del menú con una subida a medias.
- **Desafíos:** al conquistarlo por primera vez, ENTRAR abre la ventana DESAFÍOS (banda
  carmesí): cinco interruptores con casilla carmesí (Sin curas, Jefes feroces, Jefes
  sellados, Mazo corto, Frágil) y ENTRAR · n desafíos. La página del Castillo muestra el
  récord ("conquistado con n/5 desafíos").
- **Fase 2 del Soberano** (pausada, unos 9 s, para que se entienda):
  1. Se ve el golpe: su barra baja a la mitad (con su "-N"), su panel parpadea con un
     filo carmesí y sale "¡MITAD DE VIDA!" debajo, en una pastilla negra.
  2. Se para todo: destello rojo, "FASE 2", él se alza temblando con su aura que crece
     y una onda de oro.
  3. La pantalla se aclara para ver su barra: los corazones que le faltan nacen en el
     centro, saltan y vuelan uno a uno a su panel, que sube con cada uno.
  4. "EL SOBERANO DESPIERTA" y su frase. Se cierra tocando (solo al final).
  Pasa una vez por pelea (se guarda en la partida). La lógica ya le ha curado: el panel
  enseña las vidas que va animando la escena.
- **Dorsos del Castillo** (al final de la galería, con el Castillo abierto): Castillo
  (carmesí con la silueta del castillo; al conquistarlo), Mercader (azul con su
  silueta; al conseguir una legendaria) y Corona (oro con rayos carmesí y el Soberano;
  al conquistarlo con los 5 desafíos).
- **Cartas del Castillo** (Bufón, Torre, Bomba, Espía, Caballero, Sacerdotisa): figuras
  en silueta como J/Q/K, con su nombre en pequeño arriba. La insignia de ataque usa
  "?" (Bufón, copia), "–" (Torre, no ataca) y "±2" (Caballero, salta). El comodín de
  sello es una carta de sello con un interrogante; al jugarlo se elige el sello en una
  rejilla verde.
- Los logros (antes también llamados "sellos") se llaman **Logros** para no
  confundirlos con las cartas de sello.

### Meta: ajustes, sellos, estadísticas y app

- **Analíticas (PostHog, región EU):** `lib/analytics.ts`, solo en la web publicada.
  Eventos anónimos: app_opened, screen_viewed, modal_opened, tutorial_started y
  tutorial_completed, match_started y match_ended, boss_beaten, card_played,
  castle_run_started y castle_run_ended, merchant_choice, chest_opened, sovereign_phase2
  y back_equipped. Salen por `/ingest` (rewrite en `next.config.ts`) para esquivar los
  bloqueadores; el service worker no los toca. Sin clics automáticos ni grabaciones.

- **Ajustes** (rueda dentada, en el menú y en la partida; `lib/settings.ts`): sonido,
  volumen de música y de efectos, vibración, confirmar al plantarse y grano (completo, suave o apagado; apagado
  también congela la niebla del fondo: modo rendimiento).
- **Sellos** (`lib/stamps.ts`, `components/game/Stamps.tsx`): 12 logros por hacer cosas
  concretas. Cada uno es un círculo de tinta con un icono en silueta: conseguido, masa
  naranja que brilla; por conseguir, anillo pizarra. Al ganarse se estampa en pantalla
  de golpe (escala ×3 → 1, desenfoque que se enfoca, anillo de tinta, crujido, brillo y
  vibración), esperando a que termine el choque para no tapar la acción. En la lista
  cada logro lleva solo su nombre y cómo se consigue (sin "por conseguir": ya lo dice
  el anillo apagado). Gran golpe: robar una Reina con el sello de robo. Inmolación
  (llama): tu As se lleva tu propio J, Q y K (la Republicana contra ti mismo).
- **Depuración (solo quien la activa):** abrir la web con `?debug=1` (se apaga con
  `?debug=0`) añade un botón "DB" al final de la barra del menú. Su ventana repite las
  animaciones del mapa (jefe vencido → siguiente, llegada del Soberano, el Castillo se
  alza) sin tocar el progreso (`lib/debug.ts`).
- **Estadísticas ampliadas:** victorias por dificultad, derrotas, empates, porcentaje,
  últimas partidas (puntos: naranja victoria, pizarra derrota, teal empate), rachas,
  victoria más rápida, victorias sin rasguños, vidas quitadas y perdidas, carta
  favorita y la colección de sellos.
- **Tutorial guiado** (`lib/tutorial.ts`, `components/game/TutorialCoach.tsx`): la
  primera vez que juegas (y desde Ajustes → Repetir tutorial). Una partida guionizada
  de 4 rondas y 13 pasos con las reglas reales que siempre se gana: cartas normales y
  huecos vacíos → Joker y Príncipe → el rival enseña Rey y Reina y salta "¡PELIGRO!" →
  el As barre la mesa → un golpe directo y ganas. Cada explicación va dentro del paso
  que la usa (sin pantallas de "Entendido"); solo los repasos de pelea esperan a
  "Continuar". Mientras juegas, el entrenador es un cartel sobre la franja central con
  textos de ~60 caracteres y letra de 10, 9 u 8 px elegida para caber en el hueco entre
  filas de cada móvil; los repasos van abajo, sobre la mano. La carta y el hueco que
  tocan laten con un halo; lo demás queda bloqueado.
  No cuenta para estadísticas ni sellos. Un test juega el guion entero.
- **Partida guardada** (`lib/savegame.ts`): se guarda en cada turno tuyo y el menú
  ofrece "CONTINUAR PARTIDA".
- **App instalable y sin conexión:** manifiesto, icono (carta naranja que brilla con
  el rombo de luz sobre negro granulado) y service worker (`public/sw.js`).
- **Pantalla de carga:** HTML puro con el logo y una barra de brasa, visible hasta que
  cargan las fuentes.

---

### La IA de los rivales (`lib/ai.ts`)

Antes de cada jugada prueba todas sus cartas en todos los huecos con las reglas reales
(sellos de antes del choque y la pelea, con un azar fijo para el Príncipe) y puntúa lo
que pasaría: daño hecho y recibido, vidas curadas, cartas que caen de cada lado, lo que
queda en pie y si la pelea acaba la partida; gastar una carta buena para nada resta un
poco. **Normal** juega casi siempre de lo mejor (a veces no); **difícil** juega lo mejor
y se planta cuando ninguna jugada mejora lo que hay. Los cuatro primeros jefes usan la
normal (aprieta como la difícil de antes); del quinto en adelante, las revanchas, el
Castillo y el Bosque desde difícil, la difícil (gana ~87 % de las partidas a la difícil
de antes en la arena de tests, `lib/ai-arena.test.ts`).

### El Bosque (PvE, tras conquistar el Castillo)

- **Desbloqueo:** la primera vez que conquistas el Castillo, al volver al menú se apaga
  todo (input bloqueado), en la oscuridad se abren unos ojos ámbar que parpadean, sale
  "EL BOSQUE DESPIERTA" y, al irse, entra el botón ámbar "EL BOSQUE" encima de la acción
  principal (`components/screens/ForestAwaken.tsx`).
- **Su pantalla** (`ForestScreen.tsx`): en primera persona y de noche. Tres capas de
  troncos pintadas con el tramado de la niebla (lejanos finos y grises, medios, y cuatro
  enormes negros en los bordes con un filo de luz), que se mecen distinto; una banda de
  niebla en el fondo y, en ella, unos ojos ámbar que parpadean y miran a los lados.
  Arriba, volver, el título en ámbar y, como en el menú, tus sellos (verde) y tu mazo
  (naranja), una rayita y el bestiario; abajo, "BUSCAR DUELO" con tu racha.
- **Buscar duelo (gacha, por fases, input bloqueado):** primero se sortea el nivel
  (normal 57 %, difícil 28 %, pesadilla 10 %, único 5 %) y luego quién de ese nivel. Los
  ojos parpadean nerviosos → se encienden en el color de su nivel (normal crema, difícil
  naranja, pesadilla carmesí, único oro) y alguien se dibuja alrededor en silueta, con su
  nivel y su nombre arriba → se abalanza: crece de golpe, el bosque se acerca, tiembla
  todo y un fogonazo de su color da paso al duelo. Los únicos se quedan más a la vista
  (con rayos de oro y carmesí girando y un sonido de realeza). Al acabar, "VOLVER AL
  BOSQUE" y otra vez la calma, con los ojos esperando.
- **La gente del bosque** (`components/pixel/forest.ts`, `lib/forest.ts`): personas
  enmascaradas en silueta, cada una de un nivel, con lo de su oficio y su manera de jugar
  (sus sellos y, desde difícil, cartas del Castillo):
  - Normales: el Leñador y el Pastor (defensivos), la Cazadora (agresiva), el Trasgo (puñetero).
  - Difíciles: el Ermitaño (defensivo), el Salteador y el Verdugo (agresivos), la Bruja (puñetera).
  - Pesadillas: el Sepulturero (defensivo), el Lobo (agresivo), el Espantapájaros y la
    Plañidera (puñeteros).
  - **Únicos** (la realeza): el Príncipe, la Reina y el Rey, que llevan su figura tres
    veces en vez de Príncipe, Reina y Rey. Cuerpo de oro con aura de oro y carmesí,
    resplandor y, en grande, rayos girando (como el Soberano); coronas, cetro y abanico.
  En el bosque son negros con los ojos encendidos; de rival (panel, bestiario), el cuerpo
  en el color de su nivel y la máscara crema. No hablan.
- **Bestiario:** ventana ámbar con tus duelos, tu racha y tu mejor racha y, por niveles
  (Normales, Difíciles, Pesadillas y, aparte en oro, Únicos), cada personaje: los
  encontrados con su estilo, lo que hacen y sus victorias y derrotas, sus sellos (×copias) y "Copiar mazo": se copia como un código de texto
  (`MP1:sello*n…|cartas quitadas`, al portapapeles y guardado en el juego) que se pega
  con "Pegar" en el pie del editor de mazo, en el mazo activo. Solo se copian sus
  sellos (a 2 copias, hasta 5): sus cartas del Castillo solo existen allí. Los demás, en
  sombra. Logros: Sin miedo (vencer en pesadilla) y Bestiario (encontrarlos a todos).
- **Analíticas del Bosque:** `forest_entered`, `forest_encounter` (rival, dificultad) y
  `forest_duel_ended` (rival, dificultad, resultado, `win`, racha). En el panel de
  PostHog: win rate por dificultad y por rival, apariciones por rival y dificultad, y
  visitas y duelos por día.

## Cómo crear un escenario nuevo

1. **Crea la carpeta** `themes/<nombre>/index.tsx`.
2. **Texturas:** añade baldosas de grano en `components/pixel/patterns.ts` con
   `grain(tamaño, semilla, base, capas)` o `tile(w, h, (x, y) => rol)`, usando solo
   letras de rol de la paleta (o negro, d pizarra, g teal, l menta, w crema, x naranja,
   a brasa, t/T/u bando).
3. **Sprites del entorno:** dibújalos en `sprites.ts` pensando en la silueta (se
   pintan con `tint`); el detalle interno no se verá.
4. **Compón el tapete** con `themes/pieces.tsx`: `Mat` (superficie, canto y sombra),
   `Glow` (luces y niebla con degradados) y `Surface`. Sin `filter`.
5. **Exporta un `Theme`** con `Backdrop` y `Diorama({ board })`, colocando todo
   **relativo a la geometría** del tablero. Actívalo en `themes/index.ts`.
6. **Comprueba los pilares:** paleta cerrada; el naranja solo en lo importante;
   siluetas sin contorno; grano en todo; niebla en las bases; sombras largas; negro
   como espacio negativo; y las reglas de rendimiento.

## Sistema de interfaz (menús y ventanas)

La partida y los menús comparten paleta y tipografía; los menús, además, siguen un
solo sistema para que todo tenga la misma jerarquía (`components/modals/Dialog.tsx`).

- **Ventanas (`Dialog`):** misma estructura siempre. Cabecera (banda naranja con el
  título y la X de cerrar), cuerpo y, si hay acciones, un pie separado por una línea
  fina. Tres tamaños:
  - **sm** (210 px): confirmaciones y elecciones cortas (salir, pausa, mejoras del
    Castillo). Se ajustan al contenido: nunca queda media ventana vacía.
  - **md** (240 px): listas cortas con controles (ajustes, comodín). Al contenido, con
    tope y scroll.
  - **lg** (280 px): contenido largo (reglas, estadísticas, colección, editor,
    catálogo). Alto fijo; solo el cuerpo hace scroll.
  - Tono: la banda es naranja; carmesí solo en lo del Castillo.
- **Jerarquía de botones:** una sola acción principal por ventana.
  - Primario (`size="lg"`, masa naranja): SEGUIR, ¡SIGUIENTE JEFE!, ¡OTRA PARTIDA!
  - Secundario (`size="md"`, pizarra): cancelar, reglas, volver al menú.
  - Terciario (`px-btn-ghost`, sin fondo): salidas discretas (volver al menú desde la
    pausa, restablecer).
  - Peligro (`px-btn-danger`, pizarra con filo y texto naranja): borrar progreso.
  - Opciones y pestañas (`size="sm"`): la elegida en naranja, el resto en pizarra
    (`Tabs`, `Choice`).
- **Secciones (`Section`):** hueco pizarra con el título en versalitas apagadas y una
  línea debajo (`.t-section`). Ajustes se agrupa en Sonido, Partida, Pantalla y Más.
- **Texto:** cuerpo (por defecto), nota (`.t-note`, menta, para explicaciones),
  listas densas (`.t-list`) y micro (`.t-micro`, etiquetas pequeñas). Nada de tamaños
  sueltos.
- **Pie de acciones:** los botones van abajo, no mezclados con el contenido. El
  resultado de una partida usa el mismo esquema que una ventana pequeña.
- **Capas y orden:** solo una ventana a la vez. Al cambiar de pantalla o acabar la
  partida se cierra la que hubiera. Los avisos (sello nuevo, logro) esperan a que no
  haya ninguna ventana abierta y ocupan siempre el mismo sitio y ancho.
- **Mano:** ×1,375 en móviles altos (55×77), ×1 en horizontal panorámico (40×56) y
  ×0,875 en 4:3 y móviles bajos (35×49); siempre en píxeles enteros.
- **Arrastrar con ratón (PC):** cursor de mano (agarrar/agarrando); la carta crece
  desde su centro y queda bajo el cursor donde se agarró; el hueco de destino lo
  decide el cursor (con el dedo, el centro de la carta). Pulsar una carta quita su
  ficha, y la ficha por dejar el ratón encima tarda 1 s en salir para no tapar la mesa.
  También vale clic en la carta y clic en el hueco.
- **Pantalla principal: mapa de jefes** (`components/screens/SagaMap.tsx`). Un camino
  de tierra que sube por el campo de abajo arriba, entre bosques de pinos y robles en
  silueta, más cerrados hacia los bordes (`MapTerrain.tsx`: se pinta una vez en un
  lienzo con el mismo tramado estocástico que la niebla: campo oscuro con manchas,
  camino de tierra clara con rodadas y arcén negro, agua con olas, ciénaga, surcos).
  Cada jefe es una **parada del camino** en un claro de niebla, en un sitio que cuenta
  quién es (`mapStations.ts`, sprites en `components/pixel/scenery.ts`): el Forastero en
  un cruce con poste indicador y hoguera; el Muro ante un fortín de piedra con
  antorchas; la Duelista en un palenque con espadas clavadas y banderolas; el Trilero
  junto a una carpa de feria a rayas y su mesa de cubiletes; la Ladrona en su guarida
  con el carro y el botín (sacos, cofre de oro, monedas); la Matriarca en su casa de
  campo con humo, pozo y huerto; el Espejista junto a un estanque con espejos de pie;
  la Tóxica en una ciénaga con árboles muertos y un caldero; el Bardo ante su taberna
  con música en el aire; el Marinero en el muelle con su barca y un ancla; la Vidente al
  pie de una torre con un ojo encendido, menhires y chispas; el Soberano bajo una puerta
  real con estandartes de oro y braseros. Los decorados son siluetas negras y pizarra
  (a ×1,5); sus luces (ventanas, fuego, oro) brillan solo en las paradas que ya has
  alcanzado: las que faltan están a oscuras, y sin humo ni música. Cada parada es un
  **pueblo** de su temática, con casas y lugares a los dos lados del camino (el
  campamento del Forastero, el bastión amurallado del Muro, el campo del torneo de la
  Duelista, la feria del Trilero, el arrabal de la Ladrona, la aldea con molino de la
  Matriarca, el pueblo de palafitos del Espejista, la ciénaga de la Tóxica, la villa de
  la taberna del Bardo, el puerto con faro del Marinero, el santuario de la Vidente y la
  ciudad real del Soberano). Un jefe vencido ya no está: queda su pueblo con una bandera
  blanca. Las paradas se
  alternan a cada lado del camino y su decorado va hacia fuera. Sobre el camino, un
  sendero de puntos (crema lo recorrido, pizarra lo que falta). Encima de cada jefe, nada
  (ni etiquetas de "próximo rival": el jefe a batir es el que está en pie y respira; un
  vencido deja estrellas sobre su bandera, el Soberano también); debajo
  su nombre ("???" si está bloqueado) y, si está elegido, sus vidas y sus sellos (con
  muchos, "×N"). Tocar un jefe lo elige (anillo crema bajo los pies).
  Arriba del todo, el **Castillo** (silueta gótica negra de agujas cóncavas con aura
  carmesí, ventanas y portón encendidos y un resplandor rojo; `CASTLE_ART`), con su
  pastilla carmesí y su récord o el mapa de la subida; arriba a su derecha, un botón
  redondo (i) de filo carmesí abre el resumen de la última subida. Entre el Soberano y
  el Castillo hay más camino que entre pueblos (los dos son grandes y llevan texto). El
  Soberano (con resplandor de oro) y el Castillo **no se ven** hasta alcanzarlos: lo
  desconocido queda bajo una niebla densa que baja cuando se descubre.
  - En vertical el mapa llena la pantalla: logo pequeño e iconos arriba, la acción
    principal abajo, con degradados a negro para que se fundan. En horizontal, igual:
    el mapa llena la pantalla, el logo pequeño arriba a la izquierda, los iconos
    (colección y mazo | reglas, estadísticas, ajustes) arriba a la derecha y la acción
    principal centrada abajo (el Bosque, encima). La cámara encuadra el pueblo actual
    en el hueco que dejan cabecera y botones, nunca debajo de ellos.
  - Una sola acción principal ancha con el verbo grande y el contexto en pequeño
    ("¡DESAFIAR! · El Trilero", "REVANCHA · nivel 2", "SEGUIR · piso 2 de 12") y, si
    hay, continuar partida debajo.
- **Revelaciones del mapa (por fases, input bloqueado, pausadas):** al vencer a un jefe
  por primera vez, el final de partida ofrece una sola acción, "¡AL MAPA!". Allí no
  responde nada hasta acabar (la acción principal se oculta) y la cámara se desliza
  despacio (1,5 s, suave) a cada paso: el jefe vencido **se desvanece de su pueblo**
  (sube un poco, se aclara y desaparece) y en su sitio se alza una **bandera blanca** de
  rendición → el sendero se dibuja punto a punto → el siguiente se enciende con destello
  y onda, y su pueblo enciende sus luces. Unos 7 s en total.
  - **El Soberano:** aviso "ALGO DESPIERTA EN LA SOMBRA…" en oro sobre el mapa oscurecido;
    luego un haz de luz dorada con tramado baja del cielo sobre su ciudad, él desciende
    dentro muy despacio entre chispas de oro y carmesí, y al tocar tierra todo tiembla:
    dos ondas (oro y carmesí), polvo y su ciudad real se enciende. Sin etiqueta encima.
  - **El Castillo:** aviso "¡EL CASTILLO SE ALZA!"; la cámara sube mientras la niebla se
    abre; el Castillo **emerge de la tierra** (recortado a ras de suelo; ya está montado
    bajo tierra para no asomar nunca de golpe) a tirones con el mapa temblando: grietas
    carmesí que se abren en el suelo, cascotes que caen de las murallas, polvo a los
    lados, tres rayos carmesí con núcleo crema sobre las agujas y el cielo encendiéndose
    con cada uno. Ya arriba: fogonazo (la pantalla entera se blanquea y se apaga en
    carmesí), onda de choque, rayos de luz carmesí girando
    detrás, se encienden las ventanas, el aura y el resplandor, salen brasas y aparecen
    su pastilla y su nombre. Sin anillo bajo los pies.
  Al terminar se elige lo nuevo y vuelve el control. Lo ya contado se anota
  (`magic_poker_map_seen`, `lib/mapReveal.ts`), así no se repite.
- **Barra de iconos del menú:** todos con el mismo marco. Lo tuyo (colección en verde,
  mazo en naranja) va separado por una rayita de lo del juego (reglas, estadísticas,
  ajustes).
- **Icono de la app:** nocturno y misterioso: fondo negro con un rojo muy profundo,
  una luna-brasa naranja detrás de la cabeza, el Rey en silueta negra sin cetro con un
  filo de contraluz naranja, los ojos encendidos (crema con resplandor), niebla baja,
  viñeta y grano de impresión (`app/icon.png`, `app/apple-icon.png`, `public/icons/*`).
