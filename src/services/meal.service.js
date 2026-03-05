const db = require("../config/database");
const logger = require("../utils/logger");

/**
 * Meal Service - Handles global meal library and nutrition
 */
class MealService {
  /**
   * Create a new meal with nutrition energy
   */
  static async create(userId, mealData) {
    const { title, image_url, category, preparation_time, complexity, energy } = mealData;
    
    try {
      // 1. Create energy record
      const energyResult = await db.query(
        "INSERT INTO meal_energy (calories, protein, carbs, fats) VALUES ($1, $2, $3, $4) RETURNING id",
        [energy.calories || 0, energy.protein || 0, energy.carbs || 0, energy.fats || 0]
      );
      const energyId = energyResult.rows[0].id;

      // 2. Create meal record
      const mealResult = await db.query(
        "INSERT INTO meals (user_id, title, image_url, category, preparation_time, complexity, energy_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
        [userId, title, image_url, category, preparation_time, complexity, energyId]
      );

      return mealResult.rows[0];
    } catch (error) {
      logger.error(`Error creating meal: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find meal by ID with energy details
   */
  static async findById(id) {
    try {
      const result = await db.query(
        `SELECT m.*, e.calories, e.protein, e.carbs, e.fats 
         FROM meals m 
         LEFT JOIN meal_energy e ON m.energy_id = e.id 
         WHERE m.id = $1`,
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error finding meal by ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all meals for a specific user (Library)
   */
  static async findAll(userId) {
    try {
      const result = await db.query(
        `SELECT m.*, e.calories, e.protein, e.carbs, e.fats 
         FROM meals m 
         LEFT JOIN meal_energy e ON m.energy_id = e.id 
         WHERE m.user_id = $1
         ORDER BY m.created_at DESC`,
        [userId]
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error finding all meals: ${error.message}`);
      throw error;
    }
  }
}

module.exports = MealService;
