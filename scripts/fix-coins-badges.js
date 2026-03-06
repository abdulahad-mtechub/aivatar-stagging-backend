const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function fixCoinsBadgesTables() {
  const client = await pool.connect();
  try {
    console.log('--- Creating Coins, Rewards & Badge Tables ---');

    await client.query(`
      CREATE TABLE IF NOT EXISTS reward_management (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        module_type VARCHAR(50),
        trigger_event VARCHAR(100),
        reward_type VARCHAR(50),
        type VARCHAR(50) DEFAULT 'generic',
        points_amount INTEGER NOT NULL DEFAULT 10 CHECK (points_amount >= 10),
        frequency_limit VARCHAR(50),
        events_per_day INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ reward_management');

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_earned_reward_points (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rule_id INTEGER NOT NULL REFERENCES reward_management(id) ON DELETE CASCADE,
        module_type VARCHAR(50),
        point_earned_date TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ user_earned_reward_points');

    await client.query(`
      CREATE TABLE IF NOT EXISTS redeem_coin_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rule_id INTEGER NOT NULL REFERENCES reward_management(id) ON DELETE CASCADE,
        module_type VARCHAR(50),
        point_redem_date TIMESTAMP DEFAULT NOW(),
        redeem_code VARCHAR(50) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ redeem_coin_history');

    await client.query(`
      CREATE TABLE IF NOT EXISTS points_transaction (
        id SERIAL PRIMARY KEY,
        type VARCHAR(20) NOT NULL CHECK (type IN ('earned', 'redeemed')),
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rule_id INTEGER NOT NULL REFERENCES reward_management(id) ON DELETE CASCADE,
        points_amount INTEGER NOT NULL DEFAULT 0,
        module_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ points_transaction');

    await client.query(`
      CREATE TABLE IF NOT EXISTS badges (
        id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        max_points INTEGER NOT NULL,
        badge_image TEXT,
        color VARCHAR(50),
        color_value VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ badges');

    // Seed sample reward rules
    await client.query(`
      INSERT INTO reward_management (name, description, module_type, trigger_event, reward_type, points_amount, events_per_day)
      VALUES 
        ('Daily Login', 'Award coins for daily login', 'auth', 'daily_login', 'login', 10, 1),
        ('Complete Workout', 'Award coins for completing a workout', 'workout', 'workout_complete', 'workout', 50, 3)
      ON CONFLICT DO NOTHING;
    `);
    console.log('✅ Seeded 2 reward rules');

    // Seed sample badges
    await client.query(`
      INSERT INTO badges (title, max_points, color, color_value)
      VALUES 
        ('Bronze', 100, 'bronze', '#CD7F32'),
        ('Silver', 500, 'silver', '#C0C0C0'),
        ('Gold', 1000, 'gold', '#FFD700'),
        ('Platinum', 5000, 'platinum', '#E5E4E2')
      ON CONFLICT DO NOTHING;
    `);
    console.log('✅ Seeded 4 badges (Bronze, Silver, Gold, Platinum)');

    console.log('\n--- All Tables & Seeds Completed Successfully ✅ ---');
    process.exit(0);
  } catch (err) {
    console.error('❌ Fix failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixCoinsBadgesTables();
