require('dotenv').config({ path: '.env.test' });
const { execSync } = require('child_process');
const { Client } = require('pg');

const databaseUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL or TEST_DATABASE_URL is required in .env.test');
  process.exit(1);
}

function run(command) {
  execSync(command, {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: 'test' },
  });
}

async function resetSchema() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    console.log('Dropping and recreating public schema...');
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO public');
    console.log('Database schema reset complete.');
  } finally {
    await client.end();
  }
}

resetSchema()
  .then(() => {
    run('npx node-pg-migrate up --dir migrations');
    console.log('Migrations complete!');
    run('node scripts/seed-users.js');
    run('node scripts/seed-domain.js');
    run('node scripts/seed-ga-tax-rates.js');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
