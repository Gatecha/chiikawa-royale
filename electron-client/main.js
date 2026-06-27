const { app, BrowserWindow, ipcMain, shell, net } = require('electron');
const path   = require('path');
const fs     = require('fs');
const https  = require('https');

// ── App identity ──────────────────────────────────────────────────────────────
app.setAppUserModelId('com.chiikawaroyale.launcher');

// ── Single-instance lock ──────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

let mainWindow;

// ── Helpers ───────────────────────────────────────────────────────────────────
function getGameDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'game')
    : path.join(__dirname, '..');
}

function getGameIndexPath() {
  return path.join(getGameDir(), 'index.html');
}

function getLauncherPath() {
  return path.join(getGameDir(), 'launcher.html');
}

// ── Create window ─────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:  960,
    height: 640,
    frame:  false,       // Frameless — our HTML handles window chrome
    resizable: false,
    transparent: false,
    backgroundColor: '#0f1012',
    icon: path.join(__dirname, 'gamelogo.ico'),
    title: 'Chiikawa Royale',
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false, // Allow local assets from resourcesPath
    },
    show: false, // Avoid white flash
  });

  mainWindow.loadFile(getLauncherPath());

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Open all external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Go fullscreen when the game loads, restore when back in launcher
  mainWindow.webContents.on('did-navigate', (_event, url) => {
    if (url.includes('index.html')) {
      mainWindow.setResizable(true);
      mainWindow.setFullScreen(true);
    } else if (url.includes('launcher.html')) {
      mainWindow.setFullScreen(false);
      mainWindow.setResizable(false);
      mainWindow.setSize(960, 640);
      mainWindow.center();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── IPC: window controls ──────────────────────────────────────────────────────
ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window-close',    () => { if (mainWindow) mainWindow.close();    });
ipcMain.on('window-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else                          mainWindow.maximize();
});

// ── IPC: start game ───────────────────────────────────────────────────────────
ipcMain.on('start-game', () => {
  if (!mainWindow) return;
  mainWindow.setResizable(true);
  mainWindow.setFullScreen(true);
  mainWindow.loadFile(getGameIndexPath());
});

// ── IPC: get game index path (sync) ──────────────────────────────────────────
ipcMain.on('get-game-path', (event) => {
  event.returnValue = getGameIndexPath();
});

// ── Update logic ──────────────────────────────────────────────────────────────
const GITHUB_API = 'https://api.github.com/repos/Gatecha/chiikawa-royale/commits/main';
const GITHUB_ZIP = 'https://github.com/Gatecha/chiikawa-royale/archive/refs/heads/main.zip';
const VERSION_FILE = path.join(getGameDir(), '.version');

function readLocalVersion() {
  try {
    const data = fs.readFileSync(VERSION_FILE, 'utf8').trim();
    return JSON.parse(data); // { commit, version }
  } catch (_) {
    return { commit: null, version: 'unknown' };
  }
}

function writeLocalVersion(info) {
  try { fs.writeFileSync(VERSION_FILE, JSON.stringify(info), 'utf8'); } catch (_) {}
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const opts = Object.assign(require('url').parse(url), {
      headers: {
        'User-Agent': 'ChiikawaRoyale-Launcher/1.0',
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    const req = https.get(opts, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(httpsGet(res.headers.location));
        return;
      }
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end',  () => resolve({ statusCode: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// Check GitHub for newest commit SHA vs local stored SHA
ipcMain.handle('check-for-update', async () => {
  const local = readLocalVersion();
  try {
    const resp = await httpsGet(GITHUB_API);
    if (resp.statusCode !== 200) throw new Error(`HTTP ${resp.statusCode}`);
    const data = JSON.parse(resp.body);
    const latestCommit  = data.sha;
    const latestVersion = (data.commit && data.commit.message.match(/v(\d+\.\d+\.\d+)/)?.[1]) || null;
    const hasUpdate = local.commit !== latestCommit;
    return { hasUpdate, latestCommit, currentCommit: local.commit, latestVersion, currentVersion: local.version };
  } catch (err) {
    console.error('[Update] check failed:', err.message);
    return { hasUpdate: false, error: err.message, currentVersion: local.version };
  }
});

// Download update from GitHub zip, extract into game dir, write version file
ipcMain.handle('download-update', async (event) => {
  const send = (data) => {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send('update-progress', data);
  };

  send({ stage: 'downloading', pct: 0, label: 'Connecting to update server...' });

  const tmpZip = path.join(app.getPath('temp'), 'chiikawa_royale_update.zip');
  const tmpExtract = path.join(app.getPath('temp'), 'chiikawa_royale_extract');

  try {
    // ── Step 1: Download ZIP ────────────────────────────────────────────────
    await new Promise((resolve, reject) => {
      function doGet(url) {
        const opts = Object.assign(require('url').parse(url), {
          headers: { 'User-Agent': 'ChiikawaRoyale-Launcher/1.0' },
        });
        https.get(opts, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            doGet(res.headers.location); return;
          }
          const total = parseInt(res.headers['content-length'] || '0', 10);
          let received = 0;
          const file = fs.createWriteStream(tmpZip);
          res.on('data', (chunk) => {
            received += chunk.length;
            file.write(chunk);
            const pct = total ? Math.round((received / total) * 70) : 0;
            send({ stage: 'downloading', pct, label: `Downloading update... ${pct}%` });
          });
          res.on('end', () => { file.end(); resolve(); });
          res.on('error', reject);
        }).on('error', reject);
      }
      doGet(GITHUB_ZIP);
    });

    send({ stage: 'extracting', pct: 72, label: 'Extracting update files...' });

    // ── Step 2: Extract ZIP using PowerShell (built-in on Windows) ─────────
    const { execFileSync } = require('child_process');
    if (fs.existsSync(tmpExtract)) fs.rmSync(tmpExtract, { recursive: true, force: true });
    fs.mkdirSync(tmpExtract, { recursive: true });

    execFileSync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      `Expand-Archive -Path "${tmpZip}" -DestinationPath "${tmpExtract}" -Force`,
    ], { timeout: 120000 });

    send({ stage: 'extracting', pct: 85, label: 'Copying new files...' });

    // ── Step 3: Copy extracted files to game dir ────────────────────────────
    const gameDir = getGameDir();
    // The zip extracts to a subfolder like chiikawa-royale-main/
    const subDirs = fs.readdirSync(tmpExtract);
    const srcDir  = subDirs.length === 1 ? path.join(tmpExtract, subDirs[0]) : tmpExtract;

    // Only copy tracked web-app files (don't overwrite Electron runtime files)
    const COPY_EXTS = ['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.mp4', '.mp3', '.svg', '.ico', '.json'];
    const SKIP_FILES = ['package.json', 'package-lock.json', 'server.js']; // skip Node server files

    function copyDir(src, dest) {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        // Skip hidden dirs / node_modules / android-app / electron-client
        if (entry.name.startsWith('.') || entry.name === 'node_modules'
            || entry.name === 'android-app' || entry.name === 'electron-client') continue;
        const srcPath  = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          copyDir(srcPath, destPath);
        } else if (COPY_EXTS.includes(path.extname(entry.name).toLowerCase())
                   && !SKIP_FILES.includes(entry.name)) {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }

    copyDir(srcDir, gameDir);

    send({ stage: 'extracting', pct: 95, label: 'Finishing up...' });

    // ── Step 4: Fetch latest commit info and write version file ────────────
    try {
      const resp = await httpsGet(GITHUB_API);
      if (resp.statusCode === 200) {
        const data = JSON.parse(resp.body);
        writeLocalVersion({ commit: data.sha, version: require('./package.json').version });
      }
    } catch (_) {}

    // ── Step 5: Cleanup ────────────────────────────────────────────────────
    try { fs.rmSync(tmpZip,     { force: true }); } catch (_) {}
    try { fs.rmSync(tmpExtract, { recursive: true, force: true }); } catch (_) {}

    send({ stage: 'done', pct: 100, label: 'Update complete! Restarting...' });

    // Restart the launcher to reload the new files
    setTimeout(() => { app.relaunch(); app.exit(0); }, 1500);
    return { success: true };

  } catch (err) {
    console.error('[Update] download failed:', err);
    send({ stage: 'error', pct: 0, label: `Update failed: ${err.message}` });
    return { success: false, error: err.message };
  }
});

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(createWindow);

app.on('window-all-closed', () => { app.quit(); });

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
