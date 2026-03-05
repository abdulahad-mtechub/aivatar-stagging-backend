const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "your_password",
  database: process.env.DB_NAME || "reusable_backend_db",
});

async function migrate() {
  try {
    console.log("🚀 Starting database migration...");
    const sqlPath = path.join(__dirname, '../src/models/init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      try {
        await pool.query(statement);
      } catch (err) {
        if (err.message.includes("already exists") || err.message.includes("duplicate")) {
          console.log(`⚠️  Skipping: ${err.message.split('\n')[0]}`);
        } else {
          console.error(`❌ Error: ${err.message.split('\n')[0]}`);
        }
      }
    }
    console.log("✅ Migration completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}

migrate();
