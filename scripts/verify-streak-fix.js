require("dotenv").config();
const StreakService = require("../src/services/streak.service");
const RewardService = require("../src/services/reward.service");
const { pool } = require("../src/config/database");

async function verify() {
  const userId = 10;
  console.log(`Verifying for User ID: ${userId}`);

  try {
    // 1. Get Summary
    console.log("\n--- Summary Verification ---");
    const summary = await StreakService.getSummary(userId);
    console.log("Summary for 'workout':", JSON.stringify(summary.find(s => s.activity_type === 'workout'), null, 2));
    
    // 2. Get Balance
    console.log("\n--- Balance Verification ---");
    const balance = await RewardService.getUserBalance(userId);
    console.log("Balance:", balance);
    
    if (typeof balance.total_earned !== 'number') console.error("FAILED: total_earned is not a number");
    if (typeof balance.current_balance !== 'number') console.error("FAILED: current_balance is not a number");

    // 3. Check individual streak points
    const workoutStreak = summary.find(s => s.activity_type === 'workout');
    if (workoutStreak && typeof workoutStreak.total_earned_points !== 'number') {
      console.error("FAILED: workoutStreak.total_earned_points is not a number");
    }

    console.log("\n--- Tests Completed ---");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

verify();
