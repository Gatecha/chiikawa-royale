const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  minimize:              () => ipcRenderer.send('window-minimize'),
  close:                 () => ipcRenderer.send('window-close'),
  maximize:              () => ipcRenderer.send('window-maximize'),
  startGame:             () => ipcRenderer.send('start-game'),
  getGamePath:           () => ipcRenderer.sendSync('get-game-path'),
  createDesktopShortcut: () => ipcRenderer.invoke('create-desktop-shortcut'),
  checkForUpdate:        () => ipcRenderer.invoke('check-for-update'),
  downloadUpdate: (onProgress) => {
    ipcRenderer.on('update-progress', (_e, data) => onProgress(data));
    return ipcRenderer.invoke('download-update');
  },
});
