const db = require("../config/database");
const logger = require("../utils/logger");

class WorkoutService {
  /**
   * List all workout templates
   */
  static async findAll() {
    try {
      const result = await db.query(
        "SELECT * FROM workouts WHERE deleted_at IS NULL ORDER BY created_at DESC"
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error finding workouts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get workout with its exercises
   */
  static async findById(id) {
    try {
      const workoutRes = await db.query(
        "SELECT * FROM workouts WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );
      
      if (!workoutRes.rows[0]) return null;

      const exercisesRes = await db.query(
        `SELECT e.*, we.sequence_order, we.default_sets, we.default_reps 
         FROM exercises e 
         JOIN workout_exercises we ON e.id = we.exercise_id 
         WHERE we.workout_id = $1 
         ORDER BY we.sequence_order ASC`,
        [id]
      );

      return {
        ...workoutRes.rows[0],
        exercises: exercisesRes.rows
      };
    } catch (error) {
      logger.error(`Error finding workout detail: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new workout template (AI-generated from frontend)
   */
  static async create(workoutData) {
    const { name, duration_minutes, difficulty, thumbnail_url, exercises } = workoutData;
    const client = await db.pool.connect();
    
    try {
      await client.query('BEGIN');

      // 1. Create Workout
      const workoutRes = await client.query(
        `INSERT INTO workouts (name, duration_minutes, difficulty, thumbnail_url) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [name, duration_minutes, difficulty, thumbnail_url]
      );
      const workoutId = workoutRes.rows[0].id;

      // 2. Map Exercises (assuming ids are provided)
      if (exercises && Array.isArray(exercises)) {
        for (const [index, exercise] of exercises.entries()) {
          await client.query(
            `INSERT INTO workout_exercises (workout_id, exercise_id, sequence_order, default_sets, default_reps) 
             VALUES ($1, $2, $3, $4, $5)`,
            [workoutId, exercise.id, index + 1, exercise.sets || 3, exercise.reps || 10]
          );
        }
      }

      await client.query('COMMIT');
      return { ...workoutRes.rows[0], exercises: exercises || [] };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error creating workout: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = WorkoutService;
