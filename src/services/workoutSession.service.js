const db = require("../config/database");
const logger = require("../utils/logger");

class WorkoutSessionService {
  /**
   * Start a new workout session
   */
  static async startSession(userId, workoutId) {
    try {
      const result = await db.query(
        "INSERT INTO user_workout_sessions (user_id, workout_id) VALUES ($1, $2) RETURNING *",
        [userId, workoutId]
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error starting workout session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Log a set for an exercise in a session
   */
  static async logSet(sessionId, exerciseId, setData) {
    const { set_number, reps, weight, reps_target, weight_target, rest_time } = setData;
    try {
      const result = await db.query(
        `INSERT INTO workout_sets (session_id, exercise_id, set_number, actual_reps, actual_weight, target_reps, target_weight, rest_time_seconds, is_completed) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) 
         RETURNING *`,
        [sessionId, exerciseId, set_number, reps, weight, reps_target, weight_target, rest_time]
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error logging workout set: ${error.message}`);
      throw error;
    }
  }

  /**
   * Complete a workout session and calculate summary
   */
  static async completeSession(sessionId) {
    try {
      // 1. Calculate stats (Total Volume, Sets Done)
      const statsRes = await db.query(
        `SELECT SUM(actual_reps * actual_weight) as total_volume, COUNT(*) as sets_done
         FROM workout_sets 
         WHERE session_id = $1 AND is_completed = true`,
        [sessionId]
      );

      const { total_volume, sets_done } = statsRes.rows[0];

      // 2. Mark session as completed
      const result = await db.query(
        `UPDATE user_workout_sessions 
         SET end_time = NOW(), status = 'completed', total_volume = $1, calories_burned = $2
         WHERE id = $3 RETURNING *`,
        [total_volume || 0, (sets_done || 0) * 15, sessionId] // Simple calorie estimation
      );

      return result.rows[0];
    } catch (error) {
      logger.error(`Error completing workout session: ${error.message}`);
      throw error;
    }
  }
}

module.exports = WorkoutSessionService;
