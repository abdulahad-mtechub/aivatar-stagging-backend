require("dotenv").config();
const { pool } = require("../src/config/database");
const MeasurementService = require("../src/services/measurement.service");
const ReportService = require("../src/services/report.service");

async function verify() {
  const userId = 10;
  console.log(`Verifying Reports for User ID: ${userId}`);

  try {
    // 1. Setup - Ensure profile targets exist
    console.log("\n--- Setup: Ensuring profile targets exist ---");
    await pool.query(`
      INSERT INTO profiles (user_id, target_calories, target_protein, target_weight)
      VALUES ($1, 2500, 160, 75.0)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        target_calories = EXCLUDED.target_calories, 
        target_protein = EXCLUDED.target_protein, 
        target_weight = EXCLUDED.target_weight`, [userId]);
    console.log("Targets set.");

    // 2. Log Measurements
    console.log("\n--- Logging Measurements ---");
    await MeasurementService.logMeasurement(userId, {
      weight: 80.5,
      waist: 90,
      chest: 100,
      hips: 105,
      arm: 35,
      recorded_date: new Date().toISOString().split('T')[0]
    });
    console.log("Measurement logged for today.");

    // Log another one for "last week" logic (recorded_date 8 days ago)
    const lastWeekDate = new Date();
    lastWeekDate.setDate(lastWeekDate.getDate() - 8);
    await MeasurementService.logMeasurement(userId, {
      weight: 81.2,
      waist: 91,
      recorded_date: lastWeekDate.toISOString().split('T')[0]
    });
    console.log("Measurement logged for last week.");

    // 3. Verify Daily Report
    console.log("\n--- Verifying Daily Report ---");
    const daily = await ReportService.getDailyReport(userId);
    console.log("Daily Report Target Met %:", daily.target_met_percent);
    console.log("Daily Nutrition Calories:", daily.nutrition.calories);

    // 4. Verify Weekly Report
    console.log("\n--- Verifying Weekly Report ---");
    const weekly = await ReportService.getWeeklyReport(userId);
    console.log("Weight Delta:", weekly.deltas.weight);
    console.log("Summary:", weekly.summary);

    // 5. Verify Prediction
    console.log("\n--- Verifying Prediction ---");
    const prediction = await ReportService.getGoalPrediction(userId);
    console.log("Prediction Result:", JSON.stringify(prediction, null, 2));

    console.log("\n--- Verification Completed ---");
    process.exit(0);
  } catch (err) {
    console.error("Verification failed:", err.message);
    process.exit(1);
  }
}

verify();
