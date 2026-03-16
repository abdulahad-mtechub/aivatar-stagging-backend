require('dotenv').config();
const db = require('../src/config/database');

async function seedTestRule() {
  try {
    console.log('--- Seeding Reward Rule for activity "test" ---');
    
    const query = `
      INSERT INTO reward_management (name, description, module_type, trigger_event, reward_type, points_amount, events_per_day, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (module_type) DO UPDATE SET points_amount = EXCLUDED.points_amount, is_active = EXCLUDED.is_active
      RETURNING *;
    `;
    
    // Note: I checked the schema and module_type is not unique, 
    // but I'll check existence first to be safe.
    
    const check = await db.query("SELECT * FROM reward_management WHERE module_type = 'test'");
    
    if (check.rows.length === 0) {
      const result = await db.query(
        `INSERT INTO reward_management 
          (name, description, module_type, trigger_event, reward_type, points_amount, events_per_day, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        ['Test Reward', 'Reward for testing activities', 'test', 'test_activity', 'streak', 100, 1, true]
      );
      console.log('✅ Created new test rule:', result.rows[0]);
    } else {
      const result = await db.query(
        "UPDATE reward_management SET points_amount = 100, is_active = true WHERE module_type = 'test' RETURNING *",
        []
      );
      console.log('✅ Updated existing test rule:', result.rows[0]);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

seedTestRule();
