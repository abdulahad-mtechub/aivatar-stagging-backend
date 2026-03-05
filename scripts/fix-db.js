const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function fix() {
  try {
    console.log("🔍 Checking connection...");
    await pool.query('SELECT NOW()');
    console.log("✅ Connection OK");

    console.log("📝 Creating table contentmanagement...");
    const sql = `
      CREATE TABLE IF NOT EXISTS contentmanagement (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) UNIQUE NOT NULL,
        content TEXT NOT NULL,
        status BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(sql);
    console.log("✅ Table created successfully");

    console.log("📝 Creating indexes...");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_contentmanagement_type ON contentmanagement(type);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_contentmanagement_status ON contentmanagement(status);");
    console.log("✅ Indexes created successfully");

    process.exit(0);
  } catch (err) {
    console.error("❌ Error details:", err);
    process.exit(1);
  }
}

fix();
