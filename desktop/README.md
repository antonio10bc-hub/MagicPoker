# Magic Poker · escritorio (Steam, Windows)

La misma web del juego, exportada en estático y metida en Electron.

## Construir

```bash
npm run build:desktop          # en la raíz: exporta la web (DESKTOP=1) a desktop/web
cd desktop && npm install      # la primera vez
npm start                      # probarla en este ordenador
npm run dist                   # Windows x64: dist/win-unpacked (para Steam) y un .zip
```

Se puede construir desde Linux: no hace falta Wine (el icono y los datos del .exe se
editan sin él). Lo que se sube a Steam es la carpeta `dist/win-unpacked`, con
`MagicPoker.exe` como ejecutable.

## Cómo funciona

- `main.js` sirve `web/` por un protocolo propio, `app://magicpoker/`: las rutas
  absolutas (`/_next`, `/sounds`) y el guardado (localStorage, en la carpeta de datos del
  usuario, `%APPDATA%/magic-poker-desktop`) funcionan igual que en la web.
- Arranca a pantalla completa; F11 o Alt+Enter cambian a ventana (se recuerda en
  `window.json`, junto al guardado).
- `preload.js` le da al juego `window.desktop`: salir y pantalla completa (Ajustes →
  Pantalla completa, y Salir del juego).
- En la build de escritorio (`NEXT_PUBLIC_DESKTOP=1`, ver `lib/platform.ts`) no hay
  analíticas ni service worker, y en Ajustes no sale la vibración.

## Pendiente

- Guardado en archivos propios (para la nube de Steam) en vez de localStorage.
- Steamworks (logros, nube) cuando haya App ID.
- Analíticas solo si el jugador acepta.
