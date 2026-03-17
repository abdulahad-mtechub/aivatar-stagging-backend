require("dotenv").config();
const db = require("../src/config/database");
const fs = require("fs");
const path = require("path");
const logger = require("../src/utils/logger");

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, "../src/models/migrations/007_add_targets_to_workout_exercises.sql");
    const sql = fs.readFileSync(migrationPath, "utf8");

    logger.info("🚀 Running migration: 007_add_targets_to_workout_exercises.sql");
    
    // Split SQL statements by semicolon and filter out empty statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    for (const statement of statements) {
      logger.info(`📝 Executing: ${statement.substring(0, 50)}...`);
      await db.query(statement);
    }

    logger.info("✅ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    logger.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
}

runMigration();
