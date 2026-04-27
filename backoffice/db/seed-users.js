require('dotenv').config();

const bcrypt = require('bcryptjs');
const pool = require('./pool');

const users = [
  { email: 'jay@local.gdor', firstName: 'Jay', lastName: '', displayName: 'Jay', role: 'owner' },
  { email: 'zundra@local.gdor', firstName: 'Zundra', lastName: '', displayName: 'Zundra', role: 'admin' },
  { email: 'adriana@local.gdor', firstName: 'Adriana', lastName: '', displayName: 'Adriana', role: 'office' },
  { email: 'denise@local.gdor', firstName: 'Denise', lastName: '', displayName: 'Denise', role: 'marketing' },
  { email: 'deji@local.gdor', firstName: 'Deji', lastName: '', displayName: 'Deji', role: 'helper' },
];

async function run() {
  const password = process.env.SEED_USER_PASSWORD || 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(password, 10);

  for (const user of users) {
    await pool.query(
      `
      INSERT INTO users (
        email,
        password_hash,
        first_name,
        last_name,
        display_name,
        role,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (email)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        display_name = EXCLUDED.display_name,
        role = EXCLUDED.role,
        is_active = true,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        user.email,
        passwordHash,
        user.firstName || null,
        user.lastName || null,
        user.displayName,
        user.role,
      ]
    );
  }

  console.log('Seeded users into Postgres');
  await pool.end();
}

run().catch(async (err) => {
  console.error('Failed to seed users', err);
  await pool.end();
  process.exit(1);
});