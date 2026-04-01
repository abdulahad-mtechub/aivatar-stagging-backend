const db = require("../config/database");
const logger = require("../utils/logger");
const StreakService = require("./streak.service");
const MeasurementService = require("./measurement.service");

class ReportService {
  static _toYmd(dateValue) {
    if (!dateValue) return null;
    if (typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  static _shiftYmd(ymd, days) {
    const d = new Date(`${ymd}T00:00:00`);
    d.setDate(d.getDate() + days);
    return ReportService._toYmd(d);
  }

  static _resolveDailyFilter(query = {}) {
    const today = ReportService._toYmd(new Date());
    const toDate = ReportService._toYmd(query.to_date || query.date || today) || today;
    const presetRaw = String(query.filter || query.preset || query.day_filter || "")
      .trim()
      .toLowerCase();

    const presetMap = {
      "24h": 0,
      "1d": 1,
      "3d": 3,
      "5d": 5,
      "7d": 7,
      "1m": 30,
    };

    const hasCustomRange = query.from_date && query.to_date;
    if (hasCustomRange) {
      const fromDate = ReportService._toYmd(query.from_date);
      const customToDate = ReportService._toYmd(query.to_date);
      if (!fromDate || !customToDate) {
        return { invalid: true, reason: "Invalid from_date or to_date. Use YYYY-MM-DD." };
      }
      if (fromDate > customToDate) {
        return { invalid: true, reason: "from_date cannot be greater than to_date." };
      }
      return {
        mode: "custom",
        filter: "custom",
        from_date: fromDate,
        to_date: customToDate,
      };
    }

    if (presetRaw && Object.prototype.hasOwnProperty.call(presetMap, presetRaw)) {
      const days = presetMap[presetRaw];
      return {
        mode: "preset",
        filter: presetRaw,
        from_date: days === 0 ? toDate : ReportService._shiftYmd(toDate, -days),
        to_date: toDate,
      };
    }

    return {
      mode: "single_day",
      filter: "date",
      from_date: toDate,
      to_date: toDate,
    };
  }

  static async getNutritionSeries(userId, startDate, endDate) {
    const seriesRes = await db.query(
      `WITH days AS (
         SELECT generate_series($2::date, $3::date, interval '1 day')::date AS day
       ),
       consumed AS (
         SELECT
           COALESCE(mp.plan_date, mp.created_at::date)::date AS day,
           COALESCE(SUM(e.calories), 0)::float AS calories,
           COALESCE(SUM(e.protein), 0)::float AS protein,
           COALESCE(SUM(e.carbs), 0)::float AS carbs,
           COALESCE(SUM(e.fats), 0)::float AS fats
         FROM meal_plans mp
         JOIN meals m ON mp.meal_id = m.id
         JOIN meal_energy e ON m.energy_id = e.id
         WHERE mp.user_id = $1
           AND mp.status = 'completed'
           AND COALESCE(mp.plan_date, mp.created_at::date) BETWEEN $2::date AND $3::date
         GROUP BY COALESCE(mp.plan_date, mp.created_at::date)::date
       )
       SELECT
         d.day,
         COALESCE(c.calories, 0)::float AS calories,
         COALESCE(c.protein, 0)::float AS protein,
         COALESCE(c.carbs, 0)::float AS carbs,
         COALESCE(c.fats, 0)::float AS fats
       FROM days d
       LEFT JOIN consumed c ON c.day = d.day
       ORDER BY d.day ASC`,
      [userId, startDate, endDate]
    );

    return {
      from_date: startDate,
      end_date: endDate,
      carbs: seriesRes.rows.map((r) => ({
        date: ReportService._toYmd(r.day),
        consumed: Math.round(Number(r.carbs) || 0),
      })),
      calories: seriesRes.rows.map((r) => ({
        date: ReportService._toYmd(r.day),
        consumed: Math.round(Number(r.calories) || 0),
      })),
      protein: seriesRes.rows.map((r) => ({
        date: ReportService._toYmd(r.day),
        consumed: Math.round(Number(r.protein) || 0),
      })),
      fats: seriesRes.rows.map((r) => ({
        date: ReportService._toYmd(r.day),
        consumed: Math.round(Number(r.fats) || 0),
      })),
    };
  }

  /**
   * Daily Report: Nutrition + Streak + Activity
   */
  static async getDailyReport(userId, query = {}) {
    try {
      const resolved = ReportService._resolveDailyFilter(query);
      if (resolved.invalid) {
        throw new Error(resolved.reason);
      }
      const startDate = resolved.from_date;
      const endDate = resolved.to_date;

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
         AND (
           mp.plan_date = $2::date
           OR (mp.plan_date IS NULL AND mp.created_at::date = $2::date)
         )`,
        [userId, endDate]
      );

      const nutrition = consumed.rows[0] || { calories: 0, protein: 0, carbs: 0, fats: 0 };
      
      // Parse as numbers
      Object.keys(nutrition).forEach(key => {
        nutrition[key] = parseFloat(nutrition[key]) || 0;
      });

      // 3. Get Streak Info (getSummary returns { summary: [...] })
      const streakResult = await StreakService.getSummary(userId);
      const summaryList = Array.isArray(streakResult?.summary) ? streakResult.summary : [];
      const generalStreak =
        summaryList.find((s) => s.activity_type === "general") || { current_streak_days: 0 };

      // 4. Workout card (for selected date): latest completed workout on that date.
      const workoutCardRes = await db.query(
        `SELECT
           s.id,
           s.end_time,
           w.name AS workout_name
         FROM user_workout_sessions s
         LEFT JOIN workouts w ON w.id = s.workout_id
         WHERE s.user_id = $1
           AND s.status = 'completed'
           AND s.end_time::date = $2::date
         ORDER BY s.end_time DESC, s.id DESC
         LIMIT 1`,
        [userId, endDate]
      );
      const latestCompletedWorkout = workoutCardRes.rows[0] || null;

      // 5. Coins card (for selected date): total earned coins on that date.
      const coinsCardRes = await db.query(
        `SELECT COALESCE(SUM(points_amount), 0)::int AS coins_earned
         FROM points_transaction
         WHERE user_id = $1
           AND type = 'earned'
           AND created_at::date = $2::date`,
        [userId, endDate]
      );
      const coinsEarnedOnDate = Number(coinsCardRes.rows[0]?.coins_earned || 0);

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

      const nutrition_series = await ReportService.getNutritionSeries(
        userId,
        startDate,
        endDate
      );

      return {
          date: endDate,
          filter: {
            mode: resolved.mode,
            type: resolved.filter,
            from_date: startDate,
            to_date: endDate,
            presets_supported: ["24h", "1d", "3d", "5d", "7d", "1m", "custom"],
          },
          nutrition: progress,
          nutrition_series,
          streak: generalStreak.current_streak_days ?? 0,
          target_met_percent: Math.min(100, targetMetPercent),
          cards: {
            workout: {
              label: "Workout",
              date: endDate,
              completed: Boolean(latestCompletedWorkout),
              title: latestCompletedWorkout ? "Completed!" : "Not completed",
              subtitle: latestCompletedWorkout?.workout_name || null,
              session_id: latestCompletedWorkout?.id || null,
              completed_at: latestCompletedWorkout?.end_time || null,
            },
            coins: {
              label: "Today's coins",
              date: endDate,
              coins_earned: coinsEarnedOnDate,
              display_amount: `+${coinsEarnedOnDate}`,
              streak_days: generalStreak.current_streak_days ?? 0,
            },
          },
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
