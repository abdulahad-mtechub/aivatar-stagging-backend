/**
 * Fix Meal Tables Migration
 * Drops old hierarchical meal tables and recreates the flat structure
 */
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "aivatar",
});

async function fixMealTables() {
  const client = await pool.connect();
  try {
    console.log("🔄 Dropping old hierarchical meal tables...");

    // Drop in correct order (children first to avoid FK violations)
    await client.query(`DROP TABLE IF EXISTS meal_plan_slots CASCADE;`);
    console.log("  ✅ Dropped meal_plan_slots");

    await client.query(`DROP TABLE IF EXISTS meal_plan_days CASCADE;`);
    console.log("  ✅ Dropped meal_plan_days");

    await client.query(`DROP TABLE IF EXISTS meal_plan_weeks CASCADE;`);
    console.log("  ✅ Dropped meal_plan_weeks");

    await client.query(`DROP TABLE IF EXISTS meal_plans CASCADE;`);
    console.log("  ✅ Dropped meal_plans");

    await client.query(`DROP TABLE IF EXISTS meals CASCADE;`);
    console.log("  ✅ Dropped meals");

    await client.query(`DROP TABLE IF EXISTS meal_energy CASCADE;`);
    console.log("  ✅ Dropped meal_energy");

    console.log("\n🔨 Recreating tables with new flat structure...");

    // 1. meal_energy
    await client.query(`
      CREATE TABLE meal_energy (
        id SERIAL PRIMARY KEY,
        calories INTEGER DEFAULT 0,
        protein FLOAT DEFAULT 0.0,
        carbs FLOAT DEFAULT 0.0,
        fats FLOAT DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("  ✅ Created meal_energy");

    // 2. meals
    await client.query(`
      CREATE TABLE meals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        energy_id INTEGER REFERENCES meal_energy(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        preparation_time VARCHAR(50),
        complexity VARCHAR(50),
        image_url TEXT,
        category VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("  ✅ Created meals");

    // 3. flat meal_plans
    await client.query(`
      CREATE TABLE meal_plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        meal_id INTEGER REFERENCES meals(id) ON DELETE SET NULL,
        week_number INTEGER NOT NULL DEFAULT 1,
        day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
        plan_date DATE,
        slot_type VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        is_skipped BOOLEAN DEFAULT false,
        is_swapped BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("  ✅ Created meal_plans (flat)");

    // 4. Indexes
    await client.query(`CREATE INDEX idx_meal_plans_user_id ON meal_plans(user_id);`);
    await client.query(`CREATE INDEX idx_meal_plans_week_day ON meal_plans(user_id, week_number, day_of_week);`);
    console.log("  ✅ Created indexes");

    console.log("\n✅ Meal tables fixed successfully!");
  } catch (error) {
    console.error("❌ Error fixing meal tables:", error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixMealTables();
