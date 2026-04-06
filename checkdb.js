const { Client } = require('pg');
require('dotenv').config();

const client = new Client();

async function run() {
  try {
    await client.connect();
    
    console.log("Checking user 10's profile...");
    const p = await client.query('SELECT user_id, goal_id FROM profiles WHERE user_id = 10');
    console.log('Profile:', p.rows);

    if (p.rows.length && p.rows[0].goal_id) {
      console.log(`Checking goal ${p.rows[0].goal_id}...`);
      const g = await client.query('SELECT id, title, deleted_at FROM goals WHERE id = $1', [p.rows[0].goal_id]);
      console.log('Goal:', g.rows);
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
    process.exit(0);
  }
}

run();
