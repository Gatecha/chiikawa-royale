const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 640,
    frame: false,           // Frameless — our HTML handles the window chrome
    resizable: false,
    transparent: false,
    backgroundColor: '#0f1012',
    icon: path.join(__dirname, '..', 'chiikawa-royale-logo.png'),
    title: 'Chiikawa Royale',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Allow local file access so assets (images, videos, audio) load correctly
      webSecurity: false,
    },
    show: false, // Don't show until ready to prevent white flash
  });

  // Load the launcher from the game files extracted next to the exe
  // In packaged app, extraResources go to process.resourcesPath/game/
  const gamePath = app.isPackaged
    ? path.join(process.resourcesPath, 'game', 'launcher.html')
    : path.join(__dirname, '..', 'launcher.html');

  mainWindow.loadFile(gamePath);

  // Show window when fully loaded (avoids white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handlers for window controls (called from launcher HTML via preload)
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Focus window if second instance launched
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
