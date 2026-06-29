const fs = require('fs');
const path = require('path');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

const distDir = path.join(__dirname, 'dist');

// Clean dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Files to copy directly
const filesToCopy = [
  'styles.css',
  'game.js',
  'manifest.json',
  'sw.js',
  'chiikawa-royale-logo.png',
  'chiikawa-royale-logo.ico',
  'gamelogo.ico',
  'download.css',
  'download.js',
  'uwauwa.mp3',
  'hachiware-lobby.mp4',
  'hachiware-lobby_high.mp4',
  'launcher.html'
];

filesToCopy.forEach(file => {
  const srcPath = path.join(__dirname, file);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, path.join(distDir, file));
  }
});

// Folders to copy
const foldersToCopy = ['assets'];
foldersToCopy.forEach(folder => {
  const srcPath = path.join(__dirname, folder);
  if (fs.existsSync(srcPath)) {
    copyRecursiveSync(srcPath, path.join(distDir, folder));
  }
});

// Rename and copy HTML files for production routes
fs.copyFileSync(path.join(__dirname, 'download.html'), path.join(distDir, 'index.html'));
fs.copyFileSync(path.join(__dirname, 'index.html'), path.join(distDir, 'emulator.html'));

console.log('Build completed successfully! Files copied to dist/');
