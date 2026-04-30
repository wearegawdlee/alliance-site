const { execFileSync } = require('child_process');
const path = require('path');

module.exports = async function globalSetup() {
  execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'reset-test-db.js')], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env },
  });
};
