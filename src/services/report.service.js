const db = require("../config/database");
const logger = require("../utils/logger");
const StreakService = require("./streak.service");
const MeasurementService = require("./measurement.service");

class ReportService {
  /**
   * Daily Report: Nutrition + Streak + Activity
   */
  static async getDailyReport(userId, date = new Date().toISOString().split('T')[0]) {
    try {
      // 1. Fetch Nutrition Targets from Profile
      const profile = await db.query(
        `SELECT target_calories, target_protein, target_carbs, target_fats 
         FROM profiles WHERE user_id = $1`,
        [userId]
      );
      const targets = profile.rows[0] || {
        target_calories: 2000,
        target_protein: 150,
        target_carbs: 200,
        target_fats: 70
      };

      // 2. Aggregate Consumed Nutrition from completed meal plans
      const consumed = await db.query(
        `SELECT 
            SUM(e.calories) as calories, 
            SUM(e.protein) as protein, 
            SUM(e.carbs) as carbs, 
            SUM(e.fats) as fats
         FROM meal_plans mp
         JOIN meals m ON mp.meal_id = m.id
         JOIN meal_energy e ON m.energy_id = e.id
         WHERE mp.user_id = $1 AND mp.status = 'completed'
         AND (mp.plan_date = $2 OR (mp.plan_date IS NULL AND CURRENT_DATE = $2))`,
        [userId, date]
      );

      const nutrition = consumed.rows[0] || { calories: 0, protein: 0, carbs: 0, fats: 0 };
      
      // Parse as numbers
      Object.keys(nutrition).forEach(key => {
        nutrition[key] = parseFloat(nutrition[key]) || 0;
      });

      // 3. Get Streak Info
      const streaks = await StreakService.getSummary(userId);
      const generalStreak = streaks.find(s => s.activity_type === 'general') || { current_streak: 0 };

      // 4. Calculate Progress
      const progress = {
        calories: {
          consumed: Math.round(nutrition.calories),
          target: targets.target_calories,
          percent: targets.target_calories > 0 ? Math.round((nutrition.calories / targets.target_calories) * 100) : 0
        },
        protein: {
          consumed: Math.round(nutrition.protein),
          target: targets.target_protein,
          percent: targets.target_protein > 0 ? Math.round((nutrition.protein / targets.target_protein) * 100) : 0
        },
        carbs: {
          consumed: Math.round(nutrition.carbs),
          target: targets.target_carbs,
          percent: targets.target_carbs > 0 ? Math.round((nutrition.carbs / targets.target_carbs) * 100) : 0
        },
        fats: {
          consumed: Math.round(nutrition.fats),
          target: targets.target_fats,
          percent: targets.target_fats > 0 ? Math.round((nutrition.fats / targets.target_fats) * 100) : 0
        }
      };

      // Use Calories progress as the primary "Target Met" metric for the hero circle
      const targetMetPercent = progress.calories.percent;

      return {
          date,
          nutrition: progress,
          streak: generalStreak.current_streak,
          target_met_percent: Math.min(100, targetMetPercent)
      };
    } catch (error) {
      logger.error(`Error generating daily report: ${error.message}`);
      throw error;
    }
  }

  /**
   * Weekly Report: Measurement comparison
   */
  static async getWeeklyReport(userId) {
    try {
      const history = await MeasurementService.getHistory(userId, { limit: 14 });
      
      // Logic for comparing this week vs last week
      const thisWeek = history.slice(0, 7);
      const lastWeek = history.slice(7, 14);

      const latest = thisWeek[0] || {};
      const previous = lastWeek[0] || thisWeek[thisWeek.length - 1] || latest;

      const deltas = {
        weight: parseFloat(((latest.weight || 0) - (previous.weight || 0)).toFixed(1)),
        waist: parseFloat(((latest.waist || 0) - (previous.waist || 0)).toFixed(1)),
        chest: parseFloat(((latest.chest || 0) - (previous.chest || 0)).toFixed(1)),
        hips: parseFloat(((latest.hips || 0) - (previous.hips || 0)).toFixed(1))
      };

      return {
        current: latest,
        deltas,
        summary: `You lost ${Math.abs(deltas.weight).toFixed(1)} kg this week!`
      };
    } catch (error) {
      logger.error(`Error generating weekly report: ${error.message}`);
      throw error;
    }
  }

  /**
   * Goal Prediction
   */
  static async getGoalPrediction(userId) {
    try {
      const latest = await MeasurementService.getLatest(userId);
      const profile = await db.query("SELECT target_weight FROM profiles WHERE user_id = $1", [userId]);
      const targetWeight = profile.rows[0]?.target_weight;

      if (!latest || !targetWeight) {
        return { message: "More data needed for prediction" };
      }

      const diff = latest.weight - targetWeight;
      const rate = 0.5; // Average kg/week fallback
      
      let weeksNeeded = 0;
      if (diff > 0) {
        weeksNeeded = Math.ceil(diff / rate);
      }
      
      const predictionDate = new Date();
      predictionDate.setDate(predictionDate.getDate() + (weeksNeeded * 7));

      return {
        current_weight: latest.weight,
        target_weight: targetWeight,
        estimated_date: predictionDate.toISOString().split('T')[0],
        weeks_left: weeksNeeded,
        commentary: diff <= 0 ? "You've reached your weight goal! Amazing work." : "You are on track to reach your goal!"
      };
    } catch (error) {
      logger.error(`Error predicting goal: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ReportService;
