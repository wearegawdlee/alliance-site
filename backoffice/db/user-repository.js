const pool = require('./pool');
function rowToUser(row) {
  if (!row) return null;
  const roles = Array.isArray(row.roles) ? row.roles.filter(Boolean) : [];
  const serviceLineIds = Array.isArray(row.service_line_ids) ? row.service_line_ids.map(Number).filter(Boolean) : [];
  return { ...row, roles, serviceLineIds };
}
const baseSelect = `
  SELECT u.id,u.email,u.password_hash,u.display_name,u.position,u.role,u.is_active,
         COALESCE(array_agg(DISTINCT r.code ORDER BY r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles,
         COALESCE(array_agg(DISTINCT usl.service_line_id ORDER BY usl.service_line_id) FILTER (WHERE usl.service_line_id IS NOT NULL), '{}') AS service_line_ids
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id=u.id
  LEFT JOIN roles r ON r.id=ur.role_id AND r.is_active=true
  LEFT JOIN user_service_lines usl ON usl.user_id=u.id
`;
async function findActiveUserByEmail(email) { const r = await pool.query(`${baseSelect} WHERE u.email=$1 AND u.is_active=true GROUP BY u.id LIMIT 1`, [email]); return rowToUser(r.rows[0]); }
async function findUserById(id) { const r = await pool.query(`${baseSelect} WHERE u.id=$1 AND u.is_active=true GROUP BY u.id LIMIT 1`, [id]); return rowToUser(r.rows[0]); }
module.exports = { findActiveUserByEmail, findUserById };
