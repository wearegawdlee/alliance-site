require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

const users = [
  { email: 'jonathan.barradas@agdofroswell.com', name: 'Jay', position: 'Owner / Technician', roles: ['admin', 'technician'] },
  { email: 'zundra.daniel@agdofroswell.com', name: 'Zundra', position: 'Admin', roles: ['admin', 'finance'] },
  { email: 'adriana.daniel@agdofroswell.com', name: 'Adriana', position: 'Office / Finance', roles: ['finance'] },
  { email: 'denise.lee@agdofroswell.com', name: 'Denise', position: 'Marketing', roles: ['finance'] },
  { email: 'deji.lee@agdofroswell.com', name: 'Deji', position: 'Admin', roles: ['admin'] }
];

async function roleId(code) {
  const result = await pool.query('SELECT id FROM roles WHERE code=$1', [code]);
  if (!result.rows[0]) throw new Error(`Missing role: ${code}`);
  return result.rows[0].id;
}

async function run() {
  const hash = await bcrypt.hash(process.env.SEED_USER_PASSWORD || 'ChangeMe123!', 10);
  for (const user of users) {
    const result = await pool.query(`
      INSERT INTO users(email,password_hash,display_name,position,role,is_active)
      VALUES($1,$2,$3,$4,$5,true)
      ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,display_name=EXCLUDED.display_name,position=EXCLUDED.position,role=EXCLUDED.role,is_active=true,updated_at=CURRENT_TIMESTAMP
      RETURNING id
    `, [user.email, hash, user.name, user.position, user.position]);
    await pool.query('DELETE FROM user_roles WHERE user_id=$1', [result.rows[0].id]);
    for (const code of user.roles) {
      await pool.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [result.rows[0].id, await roleId(code)]);
    }
  }
  console.log('Seeded users');
  await pool.end();
}
run().catch(async e => { console.error(e); await pool.end(); process.exit(1); });
