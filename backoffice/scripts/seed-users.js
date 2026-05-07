require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

const users = [
  { email: 'jonathan.barradas@agdofroswell.com', name: 'Jay', position: 'Owner / Garage Technician', roles: ['admin', 'garage_technician'], serviceLines: ['garage_doors'] },
  { email: 'zundra.daniel@agdofroswell.com', name: 'Zundra', position: 'Admin', roles: ['admin', 'finance'], serviceLines: ['garage_doors', 'pools', 'motorized_screens'] },
  { email: 'adriana.daniel@agdofroswell.com', name: 'Adriana', position: 'Office / Finance', roles: ['finance'], serviceLines: [] },
  { email: 'denise.lee@agdofroswell.com', name: 'Denise', position: 'Marketing', roles: ['finance'], serviceLines: [] },
  { email: 'deji.lee@agdofroswell.com', name: 'Deji', position: 'Admin', roles: ['admin'], serviceLines: ['garage_doors', 'pools', 'motorized_screens'] },
  { email: 'zundra.daniel@gmail.com', name: 'Pool Guy', position: 'Pool Technician', roles: ['technician', 'pool_technician'], serviceLines: ['pools'] }
];
async function roleId(code) { const result = await pool.query('SELECT id FROM roles WHERE code=$1', [code]); if (!result.rows[0]) throw new Error(`Missing role: ${code}`); return result.rows[0].id; }
async function serviceLineId(code) { const result = await pool.query('SELECT id FROM service_lines WHERE code=$1', [code]); if (!result.rows[0]) throw new Error(`Missing service line: ${code}`); return result.rows[0].id; }
async function run() {
  const hash = await bcrypt.hash(process.env.SEED_USER_PASSWORD || 'ChangeMe123!', 10);
  for (const user of users) {
    const result = await pool.query(`
      INSERT INTO users(email,password_hash,display_name,position,role,is_active)
      VALUES($1,$2,$3,$4,$5,true)
      ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,display_name=EXCLUDED.display_name,position=EXCLUDED.position,role=EXCLUDED.role,is_active=true,updated_at=CURRENT_TIMESTAMP
      RETURNING id
    `, [user.email, hash, user.name, user.position, user.position]);
    const userId = result.rows[0].id;
    await pool.query('DELETE FROM user_roles WHERE user_id=$1', [userId]);
    for (const code of user.roles) await pool.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [userId, await roleId(code)]);
    await pool.query('DELETE FROM user_service_lines WHERE user_id=$1', [userId]);
    for (const code of user.serviceLines || []) await pool.query('INSERT INTO user_service_lines(user_id,service_line_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [userId, await serviceLineId(code)]);
  }
  console.log('Seeded users');
  await pool.end();
}
run().catch(async e => { console.error(e); await pool.end(); process.exit(1); });
