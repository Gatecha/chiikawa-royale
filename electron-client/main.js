const { app, BrowserWindow, ipcMain, shell, net } = require('electron');
const path   = require('path');
const fs     = require('fs');
const https  = require('https');

// ── App identity ──────────────────────────────────────────────────────────────
app.setAppUserModelId('com.chiikawaroyale.launcher');
app.setName('Chiikawa Royale');

// ── Single-instance lock ──────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

let mainWindow;

// ── Path helpers ──────────────────────────────────────────────────────────────
function getGameDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'game')
    : path.join(__dirname, '..');
}
function getGameIndexPath()   { return path.join(getGameDir(), 'index.html');   }
function getLauncherPath()    { return path.join(getGameDir(), 'launcher.html'); }

// ── Create window ─────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:  960,
    height: 600,
    frame:  false,
    resizable: false,
    transparent: false,
    backgroundColor: '#080809',
    icon: path.join(__dirname, 'gamelogo.ico'),
    title: 'Chiikawa Royale',
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
    },
    show: false,
  });

  mainWindow.loadFile(getLauncherPath());

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-navigate', (_event, url) => {
    if (url.includes('index.html')) {
      mainWindow.setResizable(true);
      mainWindow.setFullScreen(true);
    } else if (url.includes('launcher.html')) {
      mainWindow.setFullScreen(false);
      mainWindow.setResizable(false);
      mainWindow.setSize(960, 600);
      mainWindow.center();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── IPC: window controls ──────────────────────────────────────────────────────
ipcMain.on('window-minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
});
ipcMain.on('window-close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
});
ipcMain.on('window-maximize', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});

// ── IPC: start game ───────────────────────────────────────────────────────────
ipcMain.on('start-game', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setResizable(true);
  mainWindow.setFullScreen(true);
  mainWindow.loadFile(getGameIndexPath());
});

// ── IPC: get game path (sync) ─────────────────────────────────────────────────
ipcMain.on('get-game-path', (event) => {
  event.returnValue = getGameIndexPath();
});

// ── IPC: create desktop shortcut ─────────────────────────────────────────────
ipcMain.handle('create-desktop-shortcut', async () => {
  try {
    const desktop      = app.getPath('desktop');
    const shortcutPath = path.join(desktop, 'Chiikawa Royale.lnk');
    const target       = process.execPath;

    const created = shell.writeShortcutLink(shortcutPath, 'create', {
      target,
      icon: target,
      iconIndex: 0,
      description: 'Chiikawa Royale – Bomb Battle Royale Game',
      appUserModelId: 'com.chiikawaroyale.launcher',
    });
    return { success: created };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── Update logic ──────────────────────────────────────────────────────────────
const GITHUB_API = 'https://api.github.com/repos/Gatecha/chiikawa-royale/commits/main';
const GITHUB_ZIP = 'https://github.com/Gatecha/chiikawa-royale/archive/refs/heads/main.zip';
const VERSION_FILE = path.join(getGameDir(), '.version');

function readLocalVersion() {
  try { return JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8').trim()); }
  catch (_) { return { commit: null, version: 'unknown' }; }
}
function writeLocalVersion(info) {
  try { fs.writeFileSync(VERSION_FILE, JSON.stringify(info), 'utf8'); } catch (_) {}
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const opts = Object.assign(require('url').parse(url), {
      headers: { 'User-Agent': 'ChiikawaRoyale-Launcher/1.0', Accept: 'application/vnd.github.v3+json' },
    });
    const req = https.get(opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(httpsGet(res.headers.location)); return;
      }
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end',  () => resolve({ statusCode: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

ipcMain.handle('check-for-update', async () => {
  const local = readLocalVersion();
  try {
    const resp = await httpsGet(GITHUB_API);
    if (resp.statusCode !== 200) throw new Error(`HTTP ${resp.statusCode}`);
    const data = JSON.parse(resp.body);
    const latestCommit = data.sha;
    const latestVersion = (data.commit && data.commit.message.match(/v(\d+\.\d+\.\d+)/)?.[1]) || null;
    return { hasUpdate: local.commit !== latestCommit, latestCommit, currentCommit: local.commit, latestVersion, currentVersion: local.version };
  } catch (err) {
    return { hasUpdate: false, error: err.message, currentVersion: local.version };
  }
});

ipcMain.handle('download-update', async () => {
  const send = (data) => {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send('update-progress', data);
  };
  send({ stage: 'downloading', pct: 0, label: 'Connecting to update server...' });

  const tmpZip     = path.join(app.getPath('temp'), 'chiikawa_update.zip');
  const tmpExtract = path.join(app.getPath('temp'), 'chiikawa_extract');

  try {
    await new Promise((resolve, reject) => {
      function doGet(url) {
        const opts = Object.assign(require('url').parse(url), { headers: { 'User-Agent': 'ChiikawaRoyale-Launcher/1.0' } });
        https.get(opts, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { doGet(res.headers.location); return; }
          const total = parseInt(res.headers['content-length'] || '0', 10);
          let received = 0;
          const file = fs.createWriteStream(tmpZip);
          res.on('data', (chunk) => {
            received += chunk.length; file.write(chunk);
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
    const { execFileSync } = require('child_process');
    if (fs.existsSync(tmpExtract)) fs.rmSync(tmpExtract, { recursive: true, force: true });
    fs.mkdirSync(tmpExtract, { recursive: true });
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -Path "${tmpZip}" -DestinationPath "${tmpExtract}" -Force`], { timeout: 120000 });

    send({ stage: 'extracting', pct: 85, label: 'Copying new files...' });
    const gameDir = getGameDir();
    const subDirs = fs.readdirSync(tmpExtract);
    const srcDir  = subDirs.length === 1 ? path.join(tmpExtract, subDirs[0]) : tmpExtract;
    const COPY_EXTS  = ['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.mp4', '.mp3', '.svg', '.ico', '.json'];
    const SKIP_FILES = ['package.json', 'package-lock.json', 'server.js'];

    function copyDir(src, dest) {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        if (['.', 'node_modules', 'android-app', 'electron-client', '.git'].includes(entry.name) || entry.name.startsWith('.')) continue;
        const sp = path.join(src, entry.name), dp = path.join(dest, entry.name);
        if (entry.isDirectory()) copyDir(sp, dp);
        else if (COPY_EXTS.includes(path.extname(entry.name).toLowerCase()) && !SKIP_FILES.includes(entry.name))
          fs.copyFileSync(sp, dp);
      }
    }
    copyDir(srcDir, gameDir);

    send({ stage: 'extracting', pct: 95, label: 'Finishing up...' });
    try {
      const resp = await httpsGet(GITHUB_API);
      if (resp.statusCode === 200) {
        const data = JSON.parse(resp.body);
        writeLocalVersion({ commit: data.sha, version: require('./package.json').version });
      }
    } catch (_) {}

    try { fs.rmSync(tmpZip,     { force: true }); }            catch (_) {}
    try { fs.rmSync(tmpExtract, { recursive: true, force: true }); } catch (_) {}

    send({ stage: 'done', pct: 100, label: 'Update complete! Restarting...' });
    setTimeout(() => { app.relaunch(); app.exit(0); }, 1500);
    return { success: true };
  } catch (err) {
    send({ stage: 'error', pct: 0, label: `Update failed: ${err.message}` });
    return { success: false, error: err.message };
  }
});

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
