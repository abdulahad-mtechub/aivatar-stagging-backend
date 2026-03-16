require("dotenv").config();
const { pool } = require("../src/config/database");

async function verify() {
  const userId = 10;
  console.log(`Verifying for User ID: ${userId}`);

  try {
    // 1. Setup - Create some meals with quantities
    console.log("\n--- Setup: Updating meal quantities ---");
    const mealRes = await pool.query("SELECT id FROM meals WHERE user_id = $1 LIMIT 3", [userId]);
    const mealIds = mealRes.rows.map(r => r.id);
    
    if (mealIds.length === 0) {
      console.log("No meals found for user 10. Skipping quantity update.");
    } else {
        await pool.query("UPDATE meals SET quantity = '1 X PACK' WHERE id = $1", [mealIds[0]]);
        if (mealIds[1]) await pool.query("UPDATE meals SET quantity = '2 X 500G' WHERE id = $2", [mealIds[1]]);
        console.log(`Updated ${mealIds.length} meals with quantities.`);
    }

    // 2. Add to grocery list
    if (mealIds.length > 0) {
        console.log("\n--- Adding items to grocery list ---");
        await pool.query("UPDATE meals SET is_in_grocery = true WHERE id = ANY($1::int[])", [mealIds]);
        console.log("Items added.");
    }

    // 3. Verify Grocery List
    console.log("\n--- Verifying Grocery List ---");
    const groceryRes = await pool.query("SELECT id, title, is_in_grocery, is_bought FROM meals WHERE user_id = $1 AND is_in_grocery = true", [userId]);
    console.table(groceryRes.rows);

    // 4. Toggle Bought Status
    if (mealIds.length > 0) {
        console.log("\n--- Toggling bought status ---");
        await pool.query("UPDATE meals SET is_bought = true WHERE id = $1", [mealIds[0]]);
        const checkBought = await pool.query("SELECT id, is_bought FROM meals WHERE id = $1", [mealIds[0]]);
        console.log("Is bought:", checkBought.rows[0].is_bought);
    }

    console.log("\n--- Verification Completed ---");
    process.exit(0);
  } catch (err) {
    console.error("Verification failed:", err.message);
    process.exit(1);
  }
}

verify();
