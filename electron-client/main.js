const { app, BrowserWindow, ipcMain, shell, net, dialog } = require('electron');
const path   = require('path');
const fs     = require('fs');
const https  = require('https');

const isGameOnly = process.argv.includes('--game-only');

// ── App identity ──────────────────────────────────────────────────────────────
app.setAppUserModelId('com.chiikawaroyale.launcher');
app.setName('Chiikawa Royale');

if (isGameOnly) {
  // Use a separate user data directory for the game process to avoid lock conflicts with the launcher
  const originalUserData = app.getPath('userData');
  app.setPath('userData', originalUserData + '_game');
}

// ── Single-instance lock ──────────────────────────────────────────────────────
if (!isGameOnly) {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    process.exit(0);
  }
}

let mainWindow;

// ── Path helpers ──────────────────────────────────────────────────────────────
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const sp = path.join(src, entry.name), dp = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(sp, dp);
    else fs.copyFileSync(sp, dp);
  }
}

function getGameDir() {
  if (!app.isPackaged) {
    return path.join(__dirname, '..');
  }
  const persistentDir = path.join(app.getPath('userData'), 'game');
  if (!fs.existsSync(persistentDir)) {
    try {
      const bundleDir = path.join(process.resourcesPath, 'game');
      if (fs.existsSync(bundleDir)) {
        fs.mkdirSync(persistentDir, { recursive: true });
        copyDirSync(bundleDir, persistentDir);
      }
    } catch (err) {
      console.error('Failed to copy bundled game files to persistent directory:', err);
    }
  }
  return persistentDir;
}
function getGameIndexPath()   { return path.join(getGameDir(), 'index.html');   }
function getLauncherPath()    { return path.join(getGameDir(), 'launcher.html'); }

// ── Create window ─────────────────────────────────────────────────────────────
function createWindow() {
  if (isGameOnly) {
    mainWindow = new BrowserWindow({
      width:  1280,
      height: 720,
      fullscreen: true,
      resizable: true,
      icon: path.join(__dirname, 'gamelogo.ico'),
      title: 'Chiikawa Royale',
      webPreferences: {
        nodeIntegration:  false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: false,
      },
      show: true,
    });

    mainWindow.loadFile(getGameIndexPath());
  } else {
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
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('/auth/v1/authorize')) {
      const authWindow = new BrowserWindow({
        width: 600,
        height: 800,
        parent: mainWindow,
        modal: true,
        show: false,
        icon: path.join(__dirname, 'gamelogo.ico'),
        title: 'Sign In',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      authWindow.loadURL(url);

      authWindow.once('ready-to-show', () => {
        authWindow.show();
      });

      const handleRedirect = (redirectUrl) => {
        console.log("OAuth Redirect Intercepted:", redirectUrl);
        if (redirectUrl.includes('access_token=')) {
          try {
            // Replace hash with search to parse via URLSearchParams
            const urlObj = new URL(redirectUrl.replace('#', '?'));
            const searchParams = urlObj.searchParams;
            const accessToken = searchParams.get('access_token');
            const refreshToken = searchParams.get('refresh_token');
            const expiresAt = searchParams.get('expires_at');
            const expiresIn = searchParams.get('expires_in');
            const tokenType = searchParams.get('token_type');

            if (accessToken) {
              mainWindow.webContents.send('oauth-login-success', {
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_at: expiresAt,
                expires_in: expiresIn,
                token_type: tokenType
              });
              authWindow.destroy();
            }
          } catch (e) {
            console.error("Failed to parse OAuth redirect URL:", e);
          }
        }
      };

      authWindow.webContents.on('will-navigate', (e, navigateUrl) => {
        handleRedirect(navigateUrl);
      });

      authWindow.webContents.on('did-redirect-navigation', (e, navigateUrl) => {
        handleRedirect(navigateUrl);
      });

      return { action: 'deny' };
    }

    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (!isGameOnly) {
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
  }

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
ipcMain.handle('start-game', async () => {
  if (isGameOnly) return { success: false, error: 'Already in game mode.' };
  if (!mainWindow || mainWindow.isDestroyed()) return { success: false, error: 'Launcher window is not available.' };

  const gameIndex = getGameIndexPath();
  if (!fs.existsSync(gameIndex)) return { success: false, error: `Missing game file: ${gameIndex}` };

  try {
    mainWindow.setResizable(true);
    mainWindow.setFullScreen(true);
    await mainWindow.loadFile(gameIndex);
    mainWindow.focus();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

let returningFromGame = false;

// ── IPC: exit to launcher ─────────────────────────────────────────────────────
ipcMain.on('exit-to-launcher', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (isGameOnly) {
    mainWindow.close();
  } else {
    returningFromGame = true;
    mainWindow.setFullScreen(false);
    mainWindow.setResizable(false);
    mainWindow.setSize(960, 600);
    mainWindow.center();
    mainWindow.loadFile(getLauncherPath());
  }
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

function removeIfInside(baseDir, targetPath) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) return;
  if (fs.existsSync(resolvedTarget)) {
    fs.rmSync(resolvedTarget, { recursive: true, force: true });
  }
}

function pruneGameDirectory(gameDir) {
  if (!fs.existsSync(gameDir)) return;

  [
    'download.html',
    'download.css',
    'download.js',
    'server.js',
    'server.err.log',
    'server.out.log',
    'Super Bomberman (USA).sfc',
    'Chiikawa_Royale.apk',
    'Chiikawa_Royale.bak.apk',
    'Chiikawa_Royale.exe',
    'Chiikawa_Royale.cs',
    'Dockerfile',
    'supabase-schema.sql'
  ].forEach((name) => removeIfInside(gameDir, path.join(gameDir, name)));

  [
    path.join(gameDir, 'assets', 'launcher background', 'agwat teaser.mp4'),
    path.join(gameDir, 'assets', 'chiikawa-banner-animation.mp4'),
    path.join(gameDir, 'assets', 'chiikawa-banner-bg.png'),
    path.join(gameDir, 'assets', 'app logo')
  ].forEach((target) => removeIfInside(gameDir, target));

  function pruneGeneratedAssets(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        pruneGeneratedAssets(fullPath);
        continue;
      }
      if (/\.bak\./i.test(entry.name) || /_high\.mp4$/i.test(entry.name)) {
        removeIfInside(gameDir, fullPath);
      }
    }
  }

  pruneGeneratedAssets(path.join(gameDir, 'assets'));
}

function pruneInstalledGameFolder(targetPath) {
  const nestedGameDir = path.join(targetPath, 'Launcher', 'resources', 'game');
  const flatGameDir = path.join(targetPath, 'resources', 'game');
  pruneGameDirectory(fs.existsSync(nestedGameDir) ? nestedGameDir : flatGameDir);
}

function getInstalledGameDir(targetPath) {
  const nestedGameDir = path.join(targetPath, 'Launcher', 'resources', 'game');
  const flatGameDir = path.join(targetPath, 'resources', 'game');
  return fs.existsSync(nestedGameDir) ? nestedGameDir : flatGameDir;
}

function setWindowsHidden(targetPath) {
  if (process.platform !== 'win32' || !fs.existsSync(targetPath)) return;
  try {
    require('child_process').execFileSync('attrib.exe', ['+h', targetPath], {
      windowsHide: true,
      stdio: 'ignore'
    });
  } catch (_) {}
}

function hideInstalledGameAssets(gameDir) {
  if (!fs.existsSync(gameDir)) return;

  [
    path.join(gameDir, 'assets'),
    path.join(gameDir, 'hachiware-lobby.mp4'),
    path.join(gameDir, 'uwauwa.mp3'),
    path.join(gameDir, 'chiikawa-royale-logo.png')
  ].forEach(setWindowsHidden);

  function hideMediaFiles(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        hideMediaFiles(fullPath);
        continue;
      }
      if (/\.(png|jpe?g|mp4|mp3|svg|ico)$/i.test(entry.name)) {
        setWindowsHidden(fullPath);
      }
    }
  }

  hideMediaFiles(path.join(gameDir, 'assets'));
}

function pruneRuntimeLicenses(runtimeDir) {
  [
    'LICENSE.electron.txt',
    'LICENSES.chromium.html'
  ].forEach((name) => removeIfInside(runtimeDir, path.join(runtimeDir, name)));
}

function pruneOldRootRuntimeFiles(targetPath) {
  [
    'LICENSE.electron.txt',
    'LICENSES.chromium.html',
    'chrome_100_percent.pak',
    'chrome_200_percent.pak',
    'd3dcompiler_47.dll',
    'ffmpeg.dll',
    'icudtl.dat',
    'libEGL.dll',
    'libGLESv2.dll',
    'resources.pak',
    'snapshot_blob.bin',
    'v8_context_snapshot.bin',
    'vk_swiftshader.dll',
    'vk_swiftshader_icd.json',
    'vulkan-1.dll',
    'uninstall.exe'
  ].forEach((name) => removeIfInside(targetPath, path.join(targetPath, name)));

  [
    path.join(targetPath, 'locales'),
    path.join(targetPath, 'resources')
  ].forEach((target) => removeIfInside(targetPath, target));
}

// ── IPC: is installed (sync) ──────────────────────────────────────────────────
ipcMain.on('is-installed', (event) => {
  event.returnValue = isInstalled();
});

ipcMain.handle('repair-game-files', async () => {
  try {
    const runtimeDir = path.dirname(process.execPath);
    pruneRuntimeLicenses(runtimeDir);
    if (path.basename(runtimeDir).toLowerCase() === 'launcher') {
      pruneOldRootRuntimeFiles(path.dirname(runtimeDir));
    }
    pruneGameDirectory(getGameDir());
    hideInstalledGameAssets(getGameDir());
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
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
    const appDir = path.join(targetPath, 'Launcher');
    if (!fs.existsSync(appDir)) {
      fs.mkdirSync(appDir, { recursive: true });
    }

    // Collect all files to copy recursively
    const fileList = [];
    function collectFiles(src, dest) {
      if (src === dest) return;
      if (!fs.existsSync(src)) return;
      for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        if (s === dest) continue;
        if (entry.name === '.installed') continue;
        if (entry.name === 'LICENSE.electron.txt' || entry.name === 'LICENSES.chromium.html') continue;
        
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

    collectFiles(srcDir, appDir);

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

    pruneRuntimeLicenses(appDir);
    pruneOldRootRuntimeFiles(targetPath);
    pruneInstalledGameFolder(targetPath);
    hideInstalledGameAssets(getInstalledGameDir(targetPath));

    const destExe = path.join(appDir, 'Chiikawa_Royale.exe');
    const destResources = path.join(appDir, 'resources');
    const launcherUninstall = path.join(appDir, 'uninstall.exe');
    const rootUninstall = path.join(targetPath, 'Uninstall Chiikawa Royale.exe');
    if (fs.existsSync(launcherUninstall)) {
      await fs.promises.copyFile(launcherUninstall, rootUninstall);
    }

    sendProgress(85, 'Configuring uninstaller...');
    // uninstall.exe was copied automatically if it is in the packaged folder.
    // Make sure we log that it exists.
    if (!fs.existsSync(rootUninstall)) {
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
    fs.writeFileSync(path.join(appDir, '.installed'), JSON.stringify({
      installedAt: new Date().toISOString(),
      version: app.getVersion(),
      installRoot: targetPath
    }), 'utf8');

    // Write .version inside game directory so it starts as "Up to date"
    fs.writeFileSync(path.join(destResources, 'game', '.version'), JSON.stringify({
      commit: latestCommit,
      version: app.getVersion()
    }), 'utf8');

    try {
      shell.writeShortcutLink(path.join(targetPath, 'Chiikawa Royale.lnk'), 'create', {
        target: destExe,
        args: '--skip-loading',
        workingDirectory: appDir,
        icon: destExe,
        iconIndex: 0,
        description: 'Chiikawa Royale - Bomb Battle Royale Game',
        appUserModelId: 'com.chiikawaroyale.launcher',
      });
    } catch (err) {
      console.error('Failed to create install folder shortcut:', err.message);
    }

    sendProgress(100, 'Installation complete!');

    return { success: true, destExe, targetPath, appDir };
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
        workingDirectory: path.dirname(destExe),
        icon: destExe, // Extract icon natively from the copied executable
        iconIndex: 0,
        description: 'Chiikawa Royale – Bomb Battle Royale Game',
        appUserModelId: 'com.chiikawaroyale.launcher',
      });
    } catch (err) {
      console.error('Failed to create desktop shortcut on launch:', err.message);
    }
  }

  // Release the single-instance lock so the spawned process can acquire it!
  try {
    app.releaseSingleInstanceLock();
  } catch (err) {
    console.error('Failed to release single-instance lock:', err.message);
  }

  try {
    const { spawn } = require('child_process');
    const env = { ...process.env };
    delete env.PORTABLE_EXECUTABLE_DIR;
    delete env.PORTABLE_EXECUTABLE_FILE;

    const child = spawn(destExe, ['--skip-loading'], { 
      detached: true, 
      stdio: 'ignore',
      cwd: path.dirname(destExe),
      env: env
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

function isVersionGreater(remote, local) {
  const rParts = remote.split('.').map(Number);
  const lParts = local.split('.').map(Number);
  for (let i = 0; i < Math.max(rParts.length, lParts.length); i++) {
    const rp = rParts[i] || 0;
    const lp = lParts[i] || 0;
    if (rp > lp) return true;
    if (rp < lp) return false;
  }
  return false;
}

function getUrlSize(url) {
  return new Promise((resolve, reject) => {
    const parsed = require('url').parse(url);
    const opts = {
      method: 'HEAD',
      hostname: parsed.hostname,
      path: parsed.path,
      port: parsed.port,
      headers: { 'User-Agent': 'ChiikawaRoyale-Launcher/1.0' }
    };
    https.request(opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(getUrlSize(res.headers.location));
      } else {
        resolve(parseInt(res.headers['content-length'] || '0', 10));
      }
    }).on('error', reject).end();
  });
}

async function getFilesTotalSize(files) {
  let total = 0;
  await Promise.all(files.map(async (file) => {
    try {
      const size = await getUrlSize(file.raw_url);
      total += size;
    } catch (e) {
      total += 500 * 1024; // 500KB default estimate
    }
  }));
  return total;
}

async function getCompareFiles(currentCommit, latestCommit) {
  const url = `https://api.github.com/repos/Gatecha/chiikawa-royale/compare/${currentCommit}...${latestCommit}`;
  const resp = await httpsGet(url);
  if (resp.statusCode !== 200) throw new Error(`Compare API returned HTTP ${resp.statusCode}`);
  const data = JSON.parse(resp.body);
  return data.files || [];
}

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    
    function doGet(currentUrl) {
      const parsed = require('url').parse(currentUrl);
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
          reject(new Error(`HTTP ${res.statusCode} for ${currentUrl}`));
          return;
        }
        
        const fileStream = fs.createWriteStream(destPath);
        fileStream.on('error', (err) => {
          fileStream.close();
          reject(err);
        });
        
        res.on('data', (chunk) => {
          fileStream.write(chunk);
          onProgress(chunk.length);
        });
        
        res.on('end', () => {
          fileStream.end();
          resolve();
        });
        
        res.on('error', (err) => {
          fileStream.close();
          reject(err);
        });
      }).on('error', reject);
    }
    doGet(url);
  });
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

ipcMain.handle('check-launcher-update', async () => {
  try {
    const resp = await httpsGet('https://raw.githubusercontent.com/Gatecha/chiikawa-royale/main/electron-client/package.json');
    if (resp.statusCode !== 200) throw new Error(`HTTP ${resp.statusCode}`);
    const remotePkg = JSON.parse(resp.body);
    const remoteVersion = remotePkg.version;
    const localVersion = app.getVersion();
    
    const hasLauncherUpdate = isVersionGreater(remoteVersion, localVersion);
    return { hasUpdate: hasLauncherUpdate, latestVersion: remoteVersion, currentVersion: localVersion };
  } catch (err) {
    console.error('Error checking launcher update:', err);
    return { hasUpdate: false, error: err.message };
  }
});

ipcMain.handle('download-launcher-update', async () => {
  const send = (data) => {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send('launcher-update-progress', data);
  };
  send({ stage: 'downloading', pct: 0, label: 'Connecting to update server...' });

  const tempExePath = path.join(app.getPath('temp'), 'Chiikawa_Royale.new.exe');
  const launcherUrl = 'https://media.githubusercontent.com/media/Gatecha/chiikawa-royale/main/Chiikawa_Royale.exe';

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
          const file = fs.createWriteStream(tempExePath);

          file.on('error', (err) => {
            file.close();
            reject(err);
          });

          res.on('data', (chunk) => {
            received += chunk.length;
            file.write(chunk);

            const pct = total ? Math.round((received / total) * 100) : 0;
            const mbReceived = (received / (1024 * 1024)).toFixed(1);
            const mbTotal = total ? (total / (1024 * 1024)).toFixed(1) : '107.0';
            send({ stage: 'downloading', pct, label: `Downloading launcher... ${mbReceived} / ${mbTotal} MB` });
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
      doGet(launcherUrl);
    });

    send({ stage: 'installing', pct: 95, label: 'Installing launcher update...' });

    const { spawn } = require('child_process');
    const batPath = path.join(app.getPath('temp'), 'update_launcher.bat');
    const currentExe = process.execPath;
    const currentExeName = path.basename(currentExe);
    
    fs.writeFileSync(batPath, `
      @echo off
      timeout /t 2 /nobreak > nul
      taskkill /f /im "${currentExeName}"
      del /f /q "${currentExe}"
      move /y "${tempExePath}" "${currentExe}"
      start "" "${currentExe}"
      del "%~f0"
    `, 'utf8');

    spawn('cmd.exe', ['/c', batPath], {
      detached: true,
      stdio: 'ignore'
    }).unref();

    setTimeout(() => {
      app.quit();
    }, 500);

    send({ stage: 'done', pct: 100, label: 'Restarting...' });
    return { success: true };
  } catch (err) {
    send({ stage: 'error', pct: 0, label: `Launcher update failed: ${err.message}` });
    return { success: false, error: err.message };
  }
});

ipcMain.handle('download-update', async () => {
  const send = (data) => {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send('update-progress', data);
  };
  send({ stage: 'downloading', pct: 0, label: 'Connecting to update server...' });

  const gameDir = getGameDir();
  const local = readLocalVersion();
  let latestCommit = null;

  try {
    const resp = await httpsGet(GITHUB_API);
    if (resp.statusCode !== 200) throw new Error(`HTTP ${resp.statusCode}`);
    const data = JSON.parse(resp.body);
    latestCommit = data.sha;
  } catch (err) {
    send({ stage: 'error', pct: 0, label: `Failed to fetch update metadata: ${err.message}` });
    return { success: false, error: err.message };
  }

  const COPY_EXTS  = ['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.mp4', '.mp3', '.svg', '.ico', '.json'];
  const SKIP_FILES = ['package.json', 'package-lock.json', 'server.js'];

  let compareFiles = [];
  let isIncremental = false;
  let totalBytes = 0;

  if (local.commit) {
    try {
      send({ stage: 'downloading', pct: 5, label: 'Fetching list of changed files...' });
      compareFiles = await getCompareFiles(local.commit, latestCommit);
      
      compareFiles = compareFiles.filter(f => {
        const ext = path.extname(f.filename).toLowerCase();
        const name = path.basename(f.filename);
        if (['.', 'node_modules', 'android-app', 'electron-client', '.git'].some(dir => f.filename.startsWith(dir + '/') || f.filename === dir)) return false;
        if (f.status === 'removed') return true;
        return COPY_EXTS.includes(ext) && !SKIP_FILES.includes(name);
      });

      if (compareFiles.length > 0 && compareFiles.length < 100) {
        isIncremental = true;
      }
    } catch (err) {
      console.warn('Failed to get file comparison list, falling back to full download:', err);
    }
  }

  if (isIncremental) {
    const filesToDownload = compareFiles.filter(f => f.status !== 'removed');
    send({ stage: 'downloading', pct: 10, label: `Calculating download size for ${filesToDownload.length} files...` });
    
    try {
      totalBytes = await getFilesTotalSize(filesToDownload);
    } catch (err) {
      console.warn('Failed to get files total size, progress will use fallback estimates:', err);
    }

    try {
      let receivedBytes = 0;
      let fileIndex = 0;

      for (const file of compareFiles) {
        const destPath = path.join(gameDir, file.filename);

        if (file.status === 'removed') {
          try {
            if (fs.existsSync(destPath)) fs.rmSync(destPath, { force: true });
          } catch (_) {}
          continue;
        }

        fileIndex++;
        await downloadFile(file.raw_url, destPath, (chunkLength) => {
          receivedBytes += chunkLength;
          const pct = totalBytes ? Math.min(95, Math.round((receivedBytes / totalBytes) * 95)) : 50;
          const mbReceived = (receivedBytes / (1024 * 1024)).toFixed(1);
          const mbTotal = totalBytes ? (totalBytes / (1024 * 1024)).toFixed(1) : 'unknown';
          send({
            stage: 'downloading',
            pct,
            label: `Downloading update... ${mbReceived} / ${mbTotal} MB (File ${fileIndex}/${filesToDownload.length})`
          });
        });
      }

      send({ stage: 'extracting', pct: 95, label: 'Finishing up...' });
      pruneGameDirectory(gameDir);
      hideInstalledGameAssets(gameDir);

      writeLocalVersion({ commit: latestCommit, version: require('./package.json').version });
      send({ stage: 'done', pct: 100, label: 'Update complete!' });
      return { success: true };
    } catch (err) {
      send({ stage: 'error', pct: 0, label: `Incremental update failed: ${err.message}` });
      return { success: false, error: err.message };
    }
  } else {
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

              const pct = total 
                ? Math.round((received / total) * 70) 
                : Math.min(68, Math.round((received / (45 * 1024 * 1024)) * 70));
              const mbReceived = (received / (1024 * 1024)).toFixed(1);
              const mbTotal = total ? (total / (1024 * 1024)).toFixed(1) : '45.0';
              send({ stage: 'downloading', pct, label: `Downloading update... ${mbReceived} / ${mbTotal} MB` });
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
      const subDirs = fs.readdirSync(tmpExtract);
      const srcDir  = subDirs.length === 1 ? path.join(tmpExtract, subDirs[0]) : tmpExtract;

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
      pruneGameDirectory(gameDir);
      hideInstalledGameAssets(gameDir);

      send({ stage: 'extracting', pct: 95, label: 'Finishing up...' });
      writeLocalVersion({ commit: latestCommit, version: require('./package.json').version });

      try { fs.rmSync(tmpZip,     { force: true }); }            catch (_) {}
      try { fs.rmSync(tmpExtract, { recursive: true, force: true }); } catch (_) {}

      send({ stage: 'done', pct: 100, label: 'Update complete!' });
      return { success: true };
    } catch (err) {
      send({ stage: 'error', pct: 0, label: `Update failed: ${err.message}` });
      return { success: false, error: err.message };
    }
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
