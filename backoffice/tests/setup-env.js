require('dotenv').config();

jest.setTimeout(30000);

afterAll(async () => {
  try {
    const pool = require('../db/pool');
    await pool.end();
  } catch (err) {
    // Pool may not have been initialized in every test file.
  }
});
