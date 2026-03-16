require("dotenv").config();
const { pool } = require("../src/config/database");

async function migrate() {
  try {
    console.log("Applying database migrations for FCM...");
    
    // 1. Update users table
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(255);
    `);

    console.log("✅ Migration completed successfully");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}

migrate();
