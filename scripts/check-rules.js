require('dotenv').config();
const db = require('../src/config/database');

async function checkRules() {
  try {
    console.log('--- Reward Management Rules ---');
    const result = await db.query('SELECT * FROM reward_management');
    console.table(result.rows);
    
    console.log('\n--- User Streaks with activity_type = "test" ---');
    const streaks = await db.query('SELECT * FROM user_streaks WHERE activity_type = $1', ['test']);
    console.table(streaks.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkRules();
