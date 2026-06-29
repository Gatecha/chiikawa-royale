const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  minimize:              () => ipcRenderer.send('window-minimize'),
  close:                 () => ipcRenderer.send('window-close'),
  maximize:              () => ipcRenderer.send('window-maximize'),
  startGame:             () => ipcRenderer.invoke('start-game'),
  exitToLauncher:        () => ipcRenderer.send('exit-to-launcher'),
  getGamePath:           () => ipcRenderer.sendSync('get-game-path'),
  createDesktopShortcut: () => ipcRenderer.invoke('create-desktop-shortcut'),
  checkForUpdate:        () => ipcRenderer.invoke('check-for-update'),
  shouldSkipLoading:     () => ipcRenderer.sendSync('should-skip-loading'),
  isInstalled:           () => ipcRenderer.sendSync('is-installed'),
  repairGameFiles:       () => ipcRenderer.invoke('repair-game-files'),
  getDefaultInstallPath: () => ipcRenderer.sendSync('get-default-install-path'),
  selectFolder:          () => ipcRenderer.invoke('select-folder'),
  installGame:           (targetPath, createShortcut) => {
    ipcRenderer.on('install-progress', (_e, data) => {
      if (window.onInstallProgress) window.onInstallProgress(data);
    });
    return ipcRenderer.invoke('install-game', targetPath, createShortcut);
  },
  relaunch:               () => ipcRenderer.send('app-relaunch'),
  launchInstalledGame:    (destExe, targetPath, createShortcut) => ipcRenderer.send('launch-installed-game', destExe, targetPath, createShortcut),
  downloadUpdate: (onProgress) => {
    ipcRenderer.on('update-progress', (_e, data) => onProgress(data));
    return ipcRenderer.invoke('download-update');
  },
  checkLauncherUpdate:    () => ipcRenderer.invoke('check-launcher-update'),
  downloadLauncherUpdate: (onProgress) => {
    ipcRenderer.on('launcher-update-progress', (_e, data) => onProgress(data));
    return ipcRenderer.invoke('download-launcher-update');
  },
  onOAuthLoginSuccess: (callback) => {
    ipcRenderer.removeAllListeners('oauth-login-success');
    ipcRenderer.on('oauth-login-success', (_event, data) => callback(data));
  },
});
