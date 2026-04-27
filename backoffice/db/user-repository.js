const pool = require('./pool');

async function findActiveUserByEmail(email) {
  const result = await pool.query(
    `
    SELECT
      id,
      email,
      password_hash,
      first_name,
      last_name,
      display_name,
      role,
      is_active
    FROM users
    WHERE email = $1
      AND is_active = true
    LIMIT 1
    `,
    [email]
  );

  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await pool.query(
    `
    SELECT
      id,
      email,
      first_name,
      last_name,
      display_name,
      role,
      is_active
    FROM users
    WHERE id = $1
      AND is_active = true
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

module.exports = {
  findActiveUserByEmail,
  findUserById,
};