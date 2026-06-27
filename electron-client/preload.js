const { contextBridge, ipcRenderer } = require('electron');

// Expose safe window control APIs to the renderer (launcher.html)
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Window controls
  minimize:  () => ipcRenderer.send('window-minimize'),
  close:     () => ipcRenderer.send('window-close'),
  maximize:  () => ipcRenderer.send('window-maximize'),

  // Game launch — main process handles the navigation
  startGame: () => ipcRenderer.send('start-game'),

  // Get the absolute path to the game's index.html
  getGamePath: () => ipcRenderer.sendSync('get-game-path'),

  // Update check: resolves { hasUpdate, latestCommit, currentVersion, latestVersion }
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),

  // Download & apply update with progress events
  downloadUpdate: (onProgress) => {
    ipcRenderer.on('update-progress', (_e, data) => onProgress(data));
    return ipcRenderer.invoke('download-update');
  },
});
