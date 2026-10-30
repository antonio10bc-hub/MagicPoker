// --- MAGIC POKER · ESCRITORIO (Electron, para Steam) ---
// Sirve la web estática (npm run build:desktop → desktop/web) por un protocolo propio,
// app://magicpoker/, para que las rutas absolutas (/_next, /sounds) y el guardado del
// navegador (localStorage, en la carpeta de datos del usuario) funcionen igual que en la web.
// Arranca a pantalla completa; F11 o Alt+Enter cambian a ventana (y se recuerda).
const { app, BrowserWindow, ipcMain, net, protocol, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, 'web');
const ORIGIN = 'app://magicpoker';
const BG = '#0B0D0C';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

// Una sola copia del juego abierta
if (!app.requestSingleInstanceLock()) app.quit();

// --- Preferencias de la ventana (pantalla completa o no, tamaño) ---
const prefsFile = () => path.join(app.getPath('userData'), 'window.json');
const loadPrefs = () => {
  try { return { fullscreen: true, width: 1280, height: 800, ...JSON.parse(fs.readFileSync(prefsFile(), 'utf8')) }; }
  catch { return { fullscreen: true, width: 1280, height: 800 }; }
};
const savePrefs = prefs => { try { fs.writeFileSync(prefsFile(), JSON.stringify(prefs)); } catch { /* sin permiso: no pasa nada */ } };

/** Archivo de la web para una ruta (index.html en carpetas, .html sin extensión) */
const resolveFile = pathname => {
  const rel = decodeURIComponent(pathname).replace(/^\/+/, '');
  let file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`;
  return fs.existsSync(file) ? file : null;
};

let win = null;

const createWindow = () => {
  const prefs = loadPrefs();
  win = new BrowserWindow({
    width: prefs.width, height: prefs.height, minWidth: 960, minHeight: 600,
    fullscreen: prefs.fullscreen, backgroundColor: BG, show: false, autoHideMenuBar: true,
    title: 'Magic Poker', icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, devTools: !app.isPackaged },
  });
  win.setMenu(null);
  win.once('ready-to-show', () => win.show());

  const toggleFullscreen = () => win.setFullScreen(!win.isFullScreen());
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) { event.preventDefault(); toggleFullscreen(); }
  });
  const remember = () => {
    const [width, height] = win.isFullScreen() ? [prefs.width, prefs.height] : win.getSize();
    Object.assign(prefs, { fullscreen: win.isFullScreen(), width, height });
    savePrefs(prefs);
    win.webContents.send('desktop:fullscreen', win.isFullScreen());
  };
  win.on('enter-full-screen', remember);
  win.on('leave-full-screen', remember);
  win.on('resized', remember);

  // Enlaces externos (si los hay), en el navegador; dentro de la app, nada fuera del juego
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(ORIGIN)) event.preventDefault(); });

  win.loadURL(`${ORIGIN}/`);
};

app.whenReady().then(() => {
  protocol.handle('app', request => {
    const file = resolveFile(new URL(request.url).pathname);
    if (!file) return new Response('No encontrado', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  ipcMain.on('desktop:quit', () => app.quit());
  ipcMain.on('desktop:set-fullscreen', (_e, on) => win?.setFullScreen(!!on));
  ipcMain.handle('desktop:is-fullscreen', () => !!win?.isFullScreen());
  createWindow();
});

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
