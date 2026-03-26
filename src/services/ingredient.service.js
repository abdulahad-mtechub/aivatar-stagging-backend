const db = require("../config/database");
const logger = require("../utils/logger");

/**
 * Ingredient Service - Handles pre-measured quantities per meal
 */
class IngredientService {
  /**
   * Add a single ingredient to a meal
   */
  static async addToMeal(mealId, data) {
    const { name, quantity, unit, image_url, calories, protein, carbs, fats } = data;
    try {
      const result = await db.query(
        `INSERT INTO meal_ingredients
           (meal_id, name, quantity, unit, image_url, calories, protein, carbs, fats)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          mealId,
          name,
          quantity,
          unit || null,
          image_url || null,
          calories || 0,
          protein || 0,
          carbs || 0,
          fats || 0,
        ]
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error adding ingredient: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bulk add ingredients to a meal (replaces existing ones)
   */
  static async bulkAddToMeal(mealId, ingredients) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      // Delete existing ingredients for this meal first
      await client.query(
        "DELETE FROM meal_ingredients WHERE meal_id = $1",
        [mealId]
      );

      const inserted = [];
      for (const ing of ingredients) {
        const { name, quantity, unit, image_url, calories, protein, carbs, fats } = ing;
        const result = await client.query(
          `INSERT INTO meal_ingredients
             (meal_id, name, quantity, unit, image_url, calories, protein, carbs, fats)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            mealId,
            name,
            quantity,
            unit || null,
            image_url || null,
            calories || 0,
            protein || 0,
            carbs || 0,
            fats || 0,
          ]
        );
        inserted.push(result.rows[0]);
      }

      await client.query("COMMIT");
      return inserted;
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`Error bulk adding ingredients: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all ingredients for a specific meal
   */
  static async getByMeal(mealId) {
    try {
      const result = await db.query(
        `SELECT * FROM meal_ingredients
         WHERE meal_id = $1
         ORDER BY id ASC`,
        [mealId]
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error fetching ingredients for meal: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a single ingredient
   */
  static async update(ingredientId, mealId, data) {
    const { name, quantity, unit, image_url, calories, protein, carbs, fats } = data;
    try {
      const result = await db.query(
        `UPDATE meal_ingredients
         SET name       = COALESCE($1, name),
             quantity   = COALESCE($2, quantity),
             unit       = COALESCE($3, unit),
             image_url  = COALESCE($4, image_url),
             calories   = COALESCE($5, calories),
             protein    = COALESCE($6, protein),
             carbs      = COALESCE($7, carbs),
             fats       = COALESCE($8, fats),
             updated_at = NOW()
         WHERE id = $9 AND meal_id = $10
         RETURNING *`,
        [name, quantity, unit, image_url, calories, protein, carbs, fats, ingredientId, mealId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error updating ingredient: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a single ingredient
   */
  static async delete(ingredientId, mealId) {
    try {
      const result = await db.query(
        `DELETE FROM meal_ingredients
         WHERE id = $1 AND meal_id = $2
         RETURNING *`,
        [ingredientId, mealId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error deleting ingredient: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete all ingredients for a meal
   */
  static async deleteAllForMeal(mealId) {
    try {
      const result = await db.query(
        `DELETE FROM meal_ingredients WHERE meal_id = $1 RETURNING *`,
        [mealId]
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error deleting all ingredients for meal: ${error.message}`);
      throw error;
    }
  }
}

module.exports = IngredientService;
