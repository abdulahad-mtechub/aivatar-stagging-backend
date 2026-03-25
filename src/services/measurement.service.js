const db = require("../config/database");
const logger = require("../utils/logger");
const NotificationService = require("./notification.service");

class MeasurementService {
  /**
   * Log or update physical measurements for a specific date
   */
  static async logMeasurement(userId, data) {
    const { weight, waist, chest, hips, arm, recorded_date } = data;
    const date = recorded_date || new Date().toISOString().split('T')[0];

    let priorSameDayWeight = null;
    let priorEarlierWeight = null;
    const trackWeight =
      weight !== undefined && weight !== null && weight !== "" && !Number.isNaN(Number(weight));

    try {
      if (trackWeight) {
        const [sameDayRes, earlierRes] = await Promise.all([
          db.query(
            `SELECT weight FROM user_measurements WHERE user_id = $1 AND recorded_date = $2`,
            [userId, date]
          ),
          db.query(
            `SELECT weight FROM user_measurements
             WHERE user_id = $1 AND recorded_date < $2 AND weight IS NOT NULL
             ORDER BY recorded_date DESC
             LIMIT 1`,
            [userId, date]
          ),
        ]);
        priorSameDayWeight = sameDayRes.rows[0]?.weight ?? null;
        priorEarlierWeight = earlierRes.rows[0]?.weight ?? null;
      }

      const result = await db.query(
        `INSERT INTO user_measurements (user_id, weight, waist, chest, hips, arm, recorded_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, recorded_date) 
         DO UPDATE SET 
            weight = COALESCE(EXCLUDED.weight, user_measurements.weight),
            waist = COALESCE(EXCLUDED.waist, user_measurements.waist),
            chest = COALESCE(EXCLUDED.chest, user_measurements.chest),
            hips = COALESCE(EXCLUDED.hips, user_measurements.hips),
            arm = COALESCE(EXCLUDED.arm, user_measurements.arm),
            updated_at = NOW()
         RETURNING *`,
        [userId, weight, waist, chest, hips, arm, date]
      );
      const row = result.rows[0];

      if (trackWeight && row.weight != null) {
        await MeasurementService.maybeNotifyWeightMilestones(
          userId,
          Number(row.weight),
          priorSameDayWeight != null ? Number(priorSameDayWeight) : null,
          priorEarlierWeight != null ? Number(priorEarlierWeight) : null
        );
      }

      return row;
    } catch (error) {
      logger.error(`Error logging measurement: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fires milestone_celebration when net loss from earliest logged weight crosses 5 kg bands (5, 10, 15, …).
   */
  static async maybeNotifyWeightMilestones(userId, newWeight, priorSameDay, priorEarlier) {
    try {
      const baselineRes = await db.query(
        `SELECT weight FROM user_measurements
         WHERE user_id = $1 AND weight IS NOT NULL
         ORDER BY recorded_date ASC
         LIMIT 1`,
        [userId]
      );
      const baseline = baselineRes.rows[0]?.weight;
      if (baseline == null || Number.isNaN(Number(baseline)) || Number.isNaN(newWeight)) {
        return;
      }
      const b = Number(baseline);
      const prevW =
        priorSameDay != null && !Number.isNaN(priorSameDay)
          ? priorSameDay
          : priorEarlier != null && !Number.isNaN(priorEarlier)
            ? priorEarlier
            : null;

      const prevLoss = prevW != null ? Math.max(0, b - prevW) : 0;
      const newLoss = Math.max(0, b - newWeight);
      if (newLoss <= prevLoss) return;

      const maxTier = Math.floor(newLoss / 5) * 5;
      for (let threshold = 5; threshold <= maxTier; threshold += 5) {
        if (prevLoss >= threshold) continue;
        try {
          await NotificationService.createMilestoneCelebration(
            userId,
            {
              milestone_key: `weight_loss:${threshold}`,
              achievement_headline: `${threshold} kg down from your starting weight`,
              source: "weight",
            },
            { send_push: true, try_milestone_bonus: true }
          );
        } catch (e) {
          logger.warn(`Weight milestone celebration failed (${threshold} kg): ${e.message}`);
        }
      }
    } catch (e) {
      logger.warn(`Weight milestone check failed: ${e.message}`);
    }
  }

  /**
   * Get measurement history for a user
   */
  static async getHistory(userId, options = {}) {
    const { limit = 30, startDate, endDate } = options;
    try {
      let query = `SELECT * FROM user_measurements WHERE user_id = $1`;
      const params = [userId];

      if (startDate) {
        query += ` AND recorded_date >= $${params.length + 1}`;
        params.push(startDate);
      }
      if (endDate) {
        query += ` AND recorded_date <= $${params.length + 1}`;
        params.push(endDate);
      }

      query += ` ORDER BY recorded_date DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error(`Error fetching measurement history: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get latest measurement
   */
  static async getLatest(userId) {
    try {
      const result = await db.query(
        `SELECT * FROM user_measurements 
         WHERE user_id = $1 
         ORDER BY recorded_date DESC 
         LIMIT 1`,
        [userId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error fetching latest measurement: ${error.message}`);
      throw error;
    }
  }
}

module.exports = MeasurementService;
