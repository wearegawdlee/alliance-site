const { Pool } = require('pg');

const dbURL = process.env.NODE_ENV === 'test'
  ? process.env.TEST_DATABASE_URL
  : process.env.DATABASE_URL;

if (!dbURL) {
  throw new Error(process.env.NODE_ENV === 'test'
    ? 'TEST_DATABASE_URL is required when NODE_ENV=test'
    : 'DATABASE_URL is required');
}

module.exports = new Pool({ connectionString: dbURL });
