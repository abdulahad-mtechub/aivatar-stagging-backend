const db = require("../config/database");
const logger = require("../utils/logger");

class ExerciseService {
  /**
   * Get exercise details (Video, Audio, Guide)
   */
  static async findById(id) {
    try {
      const result = await db.query(
        "SELECT * FROM exercises WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error finding exercise by ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * List all exercises with pagination
   */
  static async findAll(options = {}) {
    const { page = 1, limit = 10, category } = options;
    const offset = (page - 1) * limit;
    
    let query = "SELECT * FROM exercises WHERE deleted_at IS NULL";
    const params = [limit, offset];

    if (category) {
      query += " AND category = $3";
      params.push(category);
    }

    query += " ORDER BY title ASC LIMIT $1 OFFSET $2";

    try {
      const countRes = await db.query("SELECT COUNT(*) FROM exercises WHERE deleted_at IS NULL" + (category ? " AND category = $1" : ""), category ? [category] : []);
      const result = await db.query(query, params);
      
      return {
        exercises: result.rows,
        total: parseInt(countRes.rows[0].count, 10)
      };
    } catch (error) {
      logger.error(`Error finding exercises: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new exercise (AI-generated from frontend)
   */
  static async create(exerciseData) {
    const { title, description, media_url, audio_url, instructions, category, target_muscle_group } = exerciseData;
    try {
      const result = await db.query(
        `INSERT INTO exercises (title, description, media_url, audio_url, instructions, category, target_muscle_group) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [title, description, media_url, audio_url, instructions || {}, category, target_muscle_group]
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error creating exercise: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ExerciseService;
