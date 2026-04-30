const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { execSync } = require('child_process');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
const envTestPath = path.join(root, '.env.test');
const envPath = path.join(root, '.env');

if (fs.existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath, override: true });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: false });
}

const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL or DATABASE_URL is required for integration tests. Prefer TEST_DATABASE_URL.');
}

const allowNonTest = process.env.ALLOW_NON_TEST_DATABASE === 'true';
const looksLikeTestDb = /test/i.test(databaseUrl);

console.log("THE DATABASE_URL", databaseUrl);

if (!allowNonTest && !looksLikeTestDb) {
  throw new Error('Refusing to reset a database whose URL does not look like a test database. Set TEST_DATABASE_URL or ALLOW_NON_TEST_DATABASE=true intentionally.');
}

const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
};

function runNode(script) {
  execFileSync(process.execPath, [path.join(root, script)], {
    cwd: root,
    stdio: 'inherit',
    env,
  });
}

function runBin(bin, args) {
  const executable = process.platform === 'win32' ? `${bin}.cmd` : bin;
  execFileSync(path.join(root, 'node_modules', '.bin', executable), args, {
    cwd: root,
    stdio: 'inherit',
    env,
  });
}

function run(command) {
  execSync(command, {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
      NODE_ENV: 'test',
    },
    cwd: path.resolve(__dirname, '..'),
  });
}

run('npx node-pg-migrate up --dir migrations');
run('node scripts/seed-users.js');
run('node scripts/seed-domain.js');
run('node scripts/seed-ga-tax-rates.js');
