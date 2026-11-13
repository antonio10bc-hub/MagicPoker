# Magic Poker · página de itch.io

Todo lo necesario para la página: textos para copiar y pegar, portada, capturas y
builds. Las builds (`itch/builds/`) no se suben al repositorio: se generan con
`npm run build:itch` (HTML5, para jugar en el navegador), y con `npm run build:desktop`
y luego `cd desktop && npm run dist` (Windows) y `npm run dist:mac` (Mac).

---

## Short description or tagline

> A dark pixel-art card duel. Play poker cards face to face, wake a cursed castle and survive the forest.

(Alternativa más corta: *Poker cards. Pixel monsters. A forest that watches you.*)

---

## Description (English)

**Magic Poker** is a dark, pixel-art card duel where every card is a fighter.

Lay your cards on four slots, face the rival's row and watch them clash: the higher card wins, empty slots let damage through, and the face cards break the rules. The Prince strikes at random, the Queen cuts both diagonals, the King hits three slots at once, the Joker takes a blow and draws you two cards, and the Ace wipes the whole board.

**A spirit shows you the way.** On a moonlit clearing, a hooded spirit takes you for a walk through the woods and teaches you, card by card, how to survive. Then the road is yours.

**12 bosses.** Each one fights with a seal (shield, double strike, mirror, poison, echo, anchor…), and beating them adds those seals to your deck. Rematch them to earn their card backs, and find out who waits at the end of the road.

**The Castle.** A roguelike climb through every boss, evolved, one after another. Your lives carry over, a merchant sells upgrades between floors, chests hide legendary cards, and six optional challenges (no healing, fierce bosses, a shorter deck…) wait for those who want the Crown.

**The Forest.** Once the Castle falls, the woods wake up. Seek duels against 16 creatures across five tiers of difficulty, fill your bestiary, and climb the Forest Mark to open three hidden realms: Nightmares, Uniques and Renegades. The harder the realm, the more each victory is worth.

- Easy to learn, hard to master: one fight lasts a few minutes.
- 10 seals, a deck editor with saved decks, unlockable card backs.
- 34 achievements.
- Generative music that changes with every boss and every realm.
- English and Spanish.

*Made with care, pixel by pixel.*

---

## Descripción (castellano)

**Magic Poker** es un duelo de cartas oscuro, en pixel art, donde cada carta es un luchador.

Pon tus cartas en cuatro huecos, frente a las del rival, y mira cómo chocan: gana la más alta, los huecos vacíos dejan pasar el daño y las figuras rompen las reglas. El Príncipe golpea al azar, la Reina corta las dos diagonales, el Rey ataca tres huecos a la vez, el Joker aguanta un golpe y te da dos cartas, y el As barre la mesa entera.

**Un ente te enseña el camino.** En un claro a la luz de la luna, un ente encapuchado te lleva de paseo por el bosque y te enseña, carta a carta, a sobrevivir. Después, el camino es tuyo.

**12 jefes.** Cada uno pelea con un sello (escudo, doble golpe, espejo, veneno, eco, ancla…) y al vencerlo ese sello entra en tu mazo. Gánales la revancha para conseguir sus dorsos, y descubre quién espera al final del camino.

**El Castillo.** Una subida roguelike por todos los jefes, evolucionados, uno tras otro. Tus vidas se arrastran, un mercader vende mejoras entre pisos, los cofres esconden cartas legendarias y seis desafíos opcionales (sin curación, jefes feroces, mazo corto…) esperan a quien quiera la Corona.

**El Bosque.** Cuando cae el Castillo, el bosque despierta. Busca duelos contra 16 criaturas en cinco niveles de dificultad, completa tu bestiario y sube la Marca del Bosque para abrir tres reinos ocultos: Pesadillas, Únicos y Renegados. Cuanto más difícil el reino, más vale cada victoria.

- Fácil de aprender, difícil de dominar: cada pelea dura unos minutos.
- 10 sellos, editor de mazo con mazos guardados y dorsos desbloqueables.
- 34 logros.
- Música generativa que cambia con cada jefe y cada reino.
- En inglés y en castellano.

---

## Ficheros para subir

| Fichero | En itch.io |
|---|---|
| `itch/cover-animated-630x500.gif` (animada, bucle de 3,6 s, 2 MB) o `itch/cover-630x500.png` (fija; `cover-1260x1000.png`, más nítida) | Cover image (el GIF se sube en el mismo campo) |
| `itch/screenshots/1-duel.jpg` … `5-the-forest.jpg` | Screenshots |
| `itch/builds/MagicPoker-web.zip` | Upload → marcar **This file will be played in the browser** |
| `itch/builds/MagicPoker-windows.zip` | Upload → marcar **Windows** |
| `itch/builds/MagicPoker-mac-apple-silicon.zip` | Upload → marcar **macOS** (nombre: "Mac (Apple Silicon: M1, M2, M3…)") |
| `itch/builds/MagicPoker-mac-intel.zip` | Upload → marcar **macOS** (nombre: "Mac (Intel)") |

### GIFs para la descripción

En el editor de la descripción, botón de imagen → subir el GIF, en estos sitios:

| GIF | Dónde |
|---|---|
| `itch/gifs/1-duel.gif` (560 px, 3 MB) | Después del primer párrafo (cómo chocan las cartas) |
| `itch/gifs/2-the-spirit.gif` (630 px, 1 MB) | Después de **A spirit shows you the way** |
| `itch/gifs/3-the-forest.gif` (630 px, 1,3 MB) | Después de **The Forest** |

### Tema de la página (Edit theme → Images)

| Fichero | Campo | Ajuste recomendado |
|---|---|---|
| `itch/theme/banner-960x300.png` (o `banner-1920x600.png`, más nítido) | **Banner** | Sustituye al título de la página: puedes ocultar el título en *Edit theme* |
| `itch/theme/background-1920x1080.jpg` | **Background** | *Repeat*: No repeat · *Position*: Center top · fondo de página (BG color) `#0B0D0C` para que funda en los bordes |
| `itch/theme/embed-bg-1280x720.jpg` | **Embed BG** | Se ve detrás del juego mientras carga |

Colores del tema a juego con el juego: fondo `#0B0D0C`, fondo del texto `#14181A`, texto
`#EDEBE0`, enlaces y botones `#FF4A1C` (el naranja del logo).

### Versión para el navegador (HTML5)

1. *Kind of project*: **HTML** (así la página muestra el juego jugable arriba; las
   descargas de Windows y Mac siguen debajo, como archivos normales).
2. Sube `MagicPoker-web.zip` y marca **This file will be played in the browser**.
3. *Embed options*: **Embed in page**, tamaño **1280 × 720** (o 960 × 600 si prefieres que
   quepa entero sin pantalla completa), marca **Mobile friendly** (orientación
   *Default*), **Automatically start on page load** y **Fullscreen button**.
4. *Frame options*: deja *Click to launch in fullscreen* desmarcado.

El progreso se guarda en el navegador del jugador (como en la web).

Sugerencias para el resto de campos: *Kind of project*: HTML (o Downloadable si solo
subes las descargas) · *Genre*: Card Game ·
*Tags*: card-game, pixel-art, roguelike, deckbuilding, dark, singleplayer, poker ·
*Release status*: Released (o In development) · *Languages*: English, Spanish.

### Aviso para Mac (añadir al final de la descripción)

> **Mac players:** the app isn't signed by Apple yet. The first time, right-click
> *Magic Poker* → **Open** → **Open**. If macOS says the app "is damaged", open Terminal and run:
> `xattr -cr "/Applications/Magic Poker.app"` (or the folder where you put it), then open it again.
