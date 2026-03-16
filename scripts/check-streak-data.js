require("dotenv").config();
const { pool } = require("../src/config/database");

async function checkData() {
  try {
    console.log("--- Reward Rules ---");
    const rules = await pool.query("SELECT id, name, module_type, points_amount FROM reward_management");
    console.table(rules.rows);

    console.log("\n--- User Streaks (User 10) ---");
    const streaks = await pool.query("SELECT id, user_id, activity_type, rule_id, steak_added_date FROM user_streaks WHERE user_id = 10");
    console.table(streaks.rows);

    console.log("\n--- Points Transactions (User 10) ---");
    const txs = await pool.query("SELECT id, user_id, rule_id, points_amount, module_type, type FROM points_transaction WHERE user_id = 10");
    console.table(txs.rows);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkData();
