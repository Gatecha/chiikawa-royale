const { contextBridge, ipcRenderer } = require('electron');

// Expose safe window control APIs to the renderer (launcher.html)
contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  close:    () => ipcRenderer.send('window-close'),
  maximize: () => ipcRenderer.send('window-maximize'),
  startGame: () => ipcRenderer.send('start-game'),
  isElectron: true,
});
