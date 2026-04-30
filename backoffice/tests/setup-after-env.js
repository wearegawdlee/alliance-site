const pool = require('../db/pool');

afterAll(async () => {
  await pool.end();
});