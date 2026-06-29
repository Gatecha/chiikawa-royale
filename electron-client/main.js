const { app, BrowserWindow, ipcMain, shell, net, dialog } = require('electron');
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
    show: true, // snaps window open immediately
  });

  mainWindow.loadFile(getLauncherPath());

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

let returningFromGame = false;

// ── IPC: exit to launcher ─────────────────────────────────────────────────────
ipcMain.on('exit-to-launcher', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  returningFromGame = true;
  mainWindow.setFullScreen(false);
  mainWindow.setResizable(false);
  mainWindow.setSize(960, 600);
  mainWindow.center();
  mainWindow.loadFile(getLauncherPath());
});

// ── IPC: get game path (sync) ─────────────────────────────────────────────────
ipcMain.on('get-game-path', (event) => {
  event.returnValue = getGameIndexPath();
});

// ── IPC: should skip loading (sync) ───────────────────────────────────────────
ipcMain.on('should-skip-loading', (event) => {
  event.returnValue = process.argv.includes('--skip-loading') || returningFromGame;
  returningFromGame = false;
});

// ── IPC: get default install path (sync) ──────────────────────────────────────
ipcMain.on('get-default-install-path', (event) => {
  const home = app.getPath('home');
  event.returnValue = path.join(home, 'Games', 'Chiikawa Royale');
});

// ── Installer helper functions ────────────────────────────────────────────────
function isInstalled() {
  if (!app.isPackaged) return true;
  const launchDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
  return fs.existsSync(path.join(launchDir, '.installed'));
}

// ── IPC: is installed (sync) ──────────────────────────────────────────────────
ipcMain.on('is-installed', (event) => {
  event.returnValue = isInstalled();
});

// ── IPC: select folder dialog ─────────────────────────────────────────────────
ipcMain.handle('select-folder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Installation Location'
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// ── IPC: install game ─────────────────────────────────────────────────────────
ipcMain.handle('install-game', async (event, targetPath, createShortcut) => {
  const sendProgress = (pct, label) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('install-progress', { pct, label });
    }
  };

  try {
    sendProgress(10, 'Creating installation directory...');
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    const srcDir = path.dirname(process.execPath);

    // Collect all files to copy recursively
    const fileList = [];
    function collectFiles(src, dest) {
      if (src === dest) return;
      if (!fs.existsSync(src)) return;
      for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        if (s === dest) continue;
        if (entry.name === '.installed') continue;
        
        let destName = entry.name;
        if (s === process.execPath) {
          destName = 'Chiikawa_Royale.exe';
        }
        const d = path.join(dest, destName);
        
        fileList.push({ src: s, dest: d, isDir: entry.isDirectory() });
        if (entry.isDirectory()) {
          collectFiles(s, d);
        }
      }
    }

    collectFiles(srcDir, targetPath);

    sendProgress(30, 'Copying program files and dependencies...');
    
    // Disable ASAR interception during file copying to copy app.asar as a normal file
    process.noAsar = true;
    try {
      const total = fileList.length;
      for (let i = 0; i < total; i++) {
        const item = fileList[i];
        if (item.isDir) {
          if (!fs.existsSync(item.dest)) {
            await fs.promises.mkdir(item.dest, { recursive: true });
          }
        } else {
          const parent = path.dirname(item.dest);
          if (!fs.existsSync(parent)) {
            await fs.promises.mkdir(parent, { recursive: true });
          }
          await fs.promises.copyFile(item.src, item.dest);
        }
        
        // Progress ranges from 30% to 80%
        const pct = Math.round(30 + ((i + 1) / total) * 50);
        const fileName = path.basename(item.dest);
        sendProgress(pct, `Copying ${fileName}...`);
        
        // Yield to event loop every 5 files to prevent UI freeze
        if (i % 5 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }
    } finally {
      process.noAsar = false;
    }

    const destExe = path.join(targetPath, 'Chiikawa_Royale.exe');
    const destResources = path.join(targetPath, 'resources');

    sendProgress(85, 'Configuring uninstaller...');
    // uninstall.exe was copied automatically if it is in the packaged folder.
    // Make sure we log that it exists.
    const destUninstall = path.join(targetPath, 'uninstall.exe');
    if (!fs.existsSync(destUninstall)) {
      console.warn('uninstall.exe was not found in destination directory.');
    }

    sendProgress(90, 'Finalizing installation...');
    
    // Fetch latest GitHub commit SHA to write to the installed .version file
    let latestCommit = null;
    try {
      const resp = await httpsGet(GITHUB_API);
      if (resp.statusCode === 200) {
        const data = JSON.parse(resp.body);
        latestCommit = data.sha;
      }
    } catch (e) {
      console.error('Failed to fetch latest commit SHA during installation:', e.message);
    }

    // Write .installed verification file
    fs.writeFileSync(path.join(targetPath, '.installed'), JSON.stringify({
      installedAt: new Date().toISOString(),
      version: app.getVersion()
    }), 'utf8');

    // Write .version inside game directory so it starts as "Up to date"
    fs.writeFileSync(path.join(destResources, 'game', '.version'), JSON.stringify({
      commit: latestCommit,
      version: app.getVersion()
    }), 'utf8');

    sendProgress(100, 'Installation complete!');

    return { success: true, destExe, targetPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: launch installed game & quit ─────────────────────────────────────────
ipcMain.on('launch-installed-game', (event, destExe, targetPath, createShortcut) => {
  if (createShortcut) {
    try {
      const desktop = app.getPath('desktop');
      const shortcutPath = path.join(desktop, 'Chiikawa Royale.lnk');
      
      shell.writeShortcutLink(shortcutPath, 'create', {
        target: destExe,
        args: '--skip-loading',
        workingDirectory: targetPath,
        icon: destExe, // Extract icon natively from the copied executable
        iconIndex: 0,
        description: 'Chiikawa Royale – Bomb Battle Royale Game',
        appUserModelId: 'com.chiikawaroyale.launcher',
      });
    } catch (err) {
      console.error('Failed to create desktop shortcut on launch:', err.message);
    }
  }

  try {
    const { spawn } = require('child_process');
    const child = spawn(destExe, ['--skip-loading'], { 
      detached: true, 
      stdio: 'ignore',
      cwd: targetPath
    });
    child.on('error', (err) => {
      console.error('Launch installed game spawn failed:', err);
    });
    child.unref();
  } catch (e) {
    console.error('Launch installed game error:', e);
  }

  setTimeout(() => {
    app.quit();
  }, 1000);
});

// ── IPC: app relaunch ────────────────────────────────────────────────────────
ipcMain.on('app-relaunch', (event) => {
  app.relaunch();
  app.exit();
});

// ── IPC: create desktop shortcut ─────────────────────────────────────────────
ipcMain.handle('create-desktop-shortcut', async () => {
  try {
    const desktop      = app.getPath('desktop');
    const shortcutPath = path.join(desktop, 'Chiikawa Royale.lnk');
    const target       = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;

    const created = shell.writeShortcutLink(shortcutPath, 'create', {
      target,
      args: '--skip-loading',
      workingDirectory: path.dirname(target),
      icon: target, // Extract icon natively from the running executable
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
        const parsed = require('url').parse(url);
        const opts = {
          hostname: parsed.hostname,
          path: parsed.path,
          port: parsed.port,
          headers: { 'User-Agent': 'ChiikawaRoyale-Launcher/1.0' }
        };
        https.get(opts, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            doGet(res.headers.location);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP status ${res.statusCode}`));
            return;
          }

          const total = parseInt(res.headers['content-length'] || '0', 10);
          let received = 0;
          const file = fs.createWriteStream(tmpZip);

          file.on('error', (err) => {
            file.close();
            reject(err);
          });

          res.on('data', (chunk) => {
            received += chunk.length;
            file.write(chunk);

            // GitHub archives usually lack content-length. Estimate pct based on ~30MB size
            const pct = total 
              ? Math.round((received / total) * 70) 
              : Math.min(68, Math.round((received / (45 * 1024 * 1024)) * 70));
            const mb = (received / (1024 * 1024)).toFixed(1);
            send({ stage: 'downloading', pct, label: `Downloading update... ${mb} MB` });
          });

          res.on('end', () => {
            file.end();
            resolve();
          });

          res.on('error', (err) => {
            file.close();
            reject(err);
          });
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

    send({ stage: 'done', pct: 100, label: 'Update complete!' });
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
