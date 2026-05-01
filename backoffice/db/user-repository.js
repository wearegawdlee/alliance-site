
const pool = require('./pool');
function rowToUser(row) { if (!row) return null; const roles = Array.isArray(row.roles) ? row.roles.filter(Boolean) : []; return { ...row, roles }; }
async function findActiveUserByEmail(email) { const r = await pool.query(`
  SELECT u.id,u.email,u.password_hash,u.display_name,u.position,u.role,u.is_active,
         COALESCE(array_agg(r.code ORDER BY r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id=u.id
  LEFT JOIN roles r ON r.id=ur.role_id AND r.is_active=true
  WHERE u.email=$1 AND u.is_active=true
  GROUP BY u.id LIMIT 1`, [email]); return rowToUser(r.rows[0]); }
async function findUserById(id) { const r = await pool.query(`
  SELECT u.id,u.email,u.display_name,u.position,u.role,u.is_active,
         COALESCE(array_agg(r.code ORDER BY r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id=u.id
  LEFT JOIN roles r ON r.id=ur.role_id AND r.is_active=true
  WHERE u.id=$1 AND u.is_active=true
  GROUP BY u.id LIMIT 1`, [id]); return rowToUser(r.rows[0]); }
module.exports = { findActiveUserByEmail, findUserById };
