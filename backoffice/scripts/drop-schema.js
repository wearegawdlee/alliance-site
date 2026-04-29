require("dotenv").config();

const pool = require("../db/pool");

async function main() {
  const dbUrl = process.env.DATABASE_URL || "";

  if (!dbUrl) {
    throw new Error("DATABASE_URL is required");
  }

  if (process.env.ALLOW_DB_RESET !== "true") {
    throw new Error("Refusing to reset DB. Set ALLOW_DB_RESET=true in .env");
  }

  console.log("Dropping and recreating public schema...");

  await pool.query("DROP SCHEMA IF EXISTS public CASCADE;");
  await pool.query("CREATE SCHEMA public;");
  await pool.query("GRANT ALL ON SCHEMA public TO CURRENT_USER;");

  console.log("Database schema reset complete.");

  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
