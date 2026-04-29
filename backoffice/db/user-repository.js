const pool = require("./pool");
async function findActiveUserByEmail(email) {
  const r = await pool.query(
    `SELECT id,email,password_hash,display_name,role,is_active FROM users WHERE email=$1 AND is_active=true LIMIT 1`,
    [email],
  );
  return r.rows[0] || null;
}
async function findUserById(id) {
  const r = await pool.query(
    `SELECT id,email,display_name,role,is_active FROM users WHERE id=$1 AND is_active=true LIMIT 1`,
    [id],
  );
  return r.rows[0] || null;
}
module.exports = { findActiveUserByEmail, findUserById };
