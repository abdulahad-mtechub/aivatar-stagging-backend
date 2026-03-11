require("dotenv").config();
const { pool } = require("../src/config/database");

async function run() {
  try {
    const res = await pool.query("SELECT * FROM reward_management LIMIT 5");
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
