// Puente mínimo entre el juego y la app de escritorio: salir y pantalla completa
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  quit: () => ipcRenderer.send('desktop:quit'),
  setFullscreen: on => ipcRenderer.send('desktop:set-fullscreen', on),
  isFullscreen: () => ipcRenderer.invoke('desktop:is-fullscreen'),
  onFullscreen: cb => {
    const listener = (_e, on) => cb(on);
    ipcRenderer.on('desktop:fullscreen', listener);
    return () => ipcRenderer.removeListener('desktop:fullscreen', listener);
  },
});
