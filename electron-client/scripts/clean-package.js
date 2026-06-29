const fs = require('fs');
const path = require('path');

module.exports = async function cleanPackage(context) {
  const appOutDir = context.appOutDir;
  const unwanted = [
    'LICENSE.electron.txt',
    'LICENSES.chromium.html'
  ];

  for (const name of unwanted) {
    const target = path.join(appOutDir, name);
    try {
      fs.rmSync(target, { force: true });
    } catch (_) {}
  }
};
