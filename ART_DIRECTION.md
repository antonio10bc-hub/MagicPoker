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

- La maquetación sigue en píxeles internos (384×288 en horizontal; ancho ~180–300 en
  vertical) escalados por enteros, así que **posiciones y tamaños no cambian**.
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
  un corazón, El Espejista (espejo) lleva gorguera y un espejo de mano, La Envenenadora
  (veneno) una capucha y un frasco que gotea, El Bardo (eco) un laúd y ondas, El
  Marinero (ancla) un ancla al hombro y La Vidente (revelar) una bola con un ojo. El
  Forastero, el primero, no tiene sello. El Soberano, jefe secreto, es enorme, con
  corona de gemas verdes y un cinturón de sellos: lleva todos.
- **Bocadillo del boss:** al empezar cada ronda dice una frase con su personalidad en
  un bocadillo crema con contorno negro junto a su panel (entrada, perdiendo,
  ganando o una de las de siempre).
- **Menú:** el boss a derrotar, grande sobre el tapete y respirando; la lista se
  desliza en horizontal (con imán y puntos de página): los vencidos dicen VENCIDO y
  los futuros salen apagados y sin nombre. JUGAR juega contra el boss en pantalla
  (los vencidos se pueden repetir, sin premio; con uno bloqueado, JUGAR se apaga).
  Con un vencido aparece debajo REVANCHA (botón con contorno verde): vuelve con una
  vida más y un segundo sello; ganarla lo marca en verde ("REVANCHA GANADA"). El jefe
  secreto no sale en la lista hasta que has vencido a los demás.
- **Editor de mazo:** al vencer a todos (también al secreto) aparece en el menú un
  botón naranja con un mazo; dentro se eligen las copias de cada sello y se quitan
  cartas bajas.
- **En partida:** la silueta del boss (negra sobre la banda naranja) en el panel del
  rival, con tantos corazones como vidas tenga (algunos tienen 5).
- **Desbloqueo:** al vencer a un boss, su sello se estampa en verde en el centro antes
  que los logros. El primero desbloquea la colección (botón verde en el menú).
- **Orden de los avisos:** sello de carta > logros > panel de final de partida. Cada
  uno espera a que se cierre el anterior.
- Los logros (antes también llamados "sellos") se llaman **Logros** para no
  confundirlos con las cartas de sello.

### Meta: ajustes, sellos, estadísticas y app

- **Ajustes** (rueda dentada, en el menú y en la partida; `lib/settings.ts`): sonido,
  volumen de música y de efectos, vibración, confirmar al plantarse y grano (completo, suave o apagado; apagado
  también congela la niebla del fondo: modo rendimiento).
- **Sellos** (`lib/stamps.ts`, `components/game/Stamps.tsx`): 12 logros por hacer cosas
  concretas. Cada uno es un círculo de tinta con un icono en silueta: conseguido, masa
  naranja que brilla; por conseguir, anillo pizarra. Al ganarse se estampa en pantalla
  de golpe (escala ×3 → 1, desenfoque que se enfoca, anillo de tinta, crujido, brillo y
  vibración), esperando a que termine el choque para no tapar la acción.
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
