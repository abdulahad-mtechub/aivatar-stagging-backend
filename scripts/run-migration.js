require("dotenv").config();
const db = require("../src/config/database");
const fs = require("fs");
const path = require("path");
const logger = require("../src/utils/logger");

async function runMigration() {
  try {
    // Usage:
    //   node scripts/run-migration.js 008_expand_workout_module.sql
    // Default: runs latest workout migration added in this task.
    const arg = process.argv[2];
    if (arg === "--help" || arg === "-h") {
      logger.info("Usage: node scripts/run-migration.js <migration_file.sql>");
      logger.info("Example: node scripts/run-migration.js 008_expand_workout_module.sql");
      process.exit(0);
    }

    const migrationFile = arg || "008_expand_workout_module.sql";
    const migrationPath = path.join(
      __dirname,
      "../src/models/migrations/",
      migrationFile
    );
    const sql = fs.readFileSync(migrationPath, "utf8");

    logger.info(`🚀 Running migration: ${path.basename(migrationPath)}`);
    
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
