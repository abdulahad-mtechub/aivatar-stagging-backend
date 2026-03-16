const db = require("../config/database");
const logger = require("../utils/logger");

class MeasurementService {
  /**
   * Log or update physical measurements for a specific date
   */
  static async logMeasurement(userId, data) {
    const { weight, waist, chest, hips, arm, recorded_date } = data;
    const date = recorded_date || new Date().toISOString().split('T')[0];

    try {
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
      return result.rows[0];
    } catch (error) {
      logger.error(`Error logging measurement: ${error.message}`);
      throw error;
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
