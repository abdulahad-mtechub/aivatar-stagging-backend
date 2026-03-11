require("dotenv").config();
const { pool } = require("../src/config/database");
const logger = require("../src/utils/logger");

async function addMealDescription() {
  try {
    console.log("Adding description column to meals table...");
    await pool.query("ALTER TABLE meals ADD COLUMN IF NOT EXISTS description TEXT;");
    console.log("✅ Column added successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to add column:", error.message);
    process.exit(1);
  }
}

addMealDescription();
