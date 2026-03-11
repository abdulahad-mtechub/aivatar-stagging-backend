const { pool } = require("../config/database");
const logger = require("../utils/logger");

/**
 * Service for managing user streaks
 */
class StreakService {
  /**
   * Record activity for today
   * @param {number} userId - User ID
   */
  static async createStreak(userId) {
    const query = `
      INSERT INTO user_streaks (user_id, steak_added_date, is_streak)
      VALUES ($1, NOW(), 1)
      RETURNING *
    `;
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  }

  /**
   * Get current streak count and evaluate for expiration
   * @param {number} userId - User ID
   */
  static async getStreaks(userId) {
    // 1. EVALUATION (Lazy Evaluation)
    // Check if the user missed yesterday
    const lastActivityQuery = `
      SELECT MAX(steak_added_date) as last_date 
      FROM user_streaks 
      WHERE user_id = $1 AND is_streak = 1
    `;
    const lastActivity = await pool.query(lastActivityQuery, [userId]);

    if (lastActivity.rows[0].last_date) {
      const lastDate = new Date(lastActivity.rows[0].last_date);
      const now = new Date();
      
      // Calculate day difference
      const diffTime = Math.abs(now - lastDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 1) {
        // Missed day(s), reset current streak
        logger.info(`Streak expired for user ${userId}. Missed ${diffDays} days.`);
        await pool.query(
          "UPDATE user_streaks SET is_streak = 0 WHERE user_id = $1 AND is_streak = 1",
          [userId]
        );
      }
    }

    // 2. RETRIEVAL
    // Count continuous active records
    const countQuery = `
      SELECT COUNT(*) as streak_count 
      FROM user_streaks 
      WHERE user_id = $1 AND is_streak = 1
    `;
    const countResult = await pool.query(countQuery, [userId]);
    
    return {
      streak_count: parseInt(countResult.rows[0].streak_count)
    };
  }

  /**
   * Restore expired streaks
   * @param {number} userId - User ID
   */
  static async restoreStreaks(userId) {
    const query = `
      UPDATE user_streaks 
      SET is_streak = 1, is_restored = TRUE, updated_at = NOW() 
      WHERE user_id = $1 AND is_streak = 0
      RETURNING *
    `;
    const result = await pool.query(query, [userId]);
    
    return {
      restored_count: result.rowCount,
      records: result.rows
    };
  }
}

module.exports = StreakService;
