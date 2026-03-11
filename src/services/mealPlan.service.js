const db = require("../config/database");
const logger = require("../utils/logger");

/**
 * Meal Plan Service - Handles flat meal plan table
 */
class MealPlanService {

  /**
   * Add a single meal slot to the user's plan
   */
  static async addSlot(userId, data) {
    const { meal_id, week_number, day_of_week, plan_date, slot_type } = data;
    try {
      const result = await db.query(
        `INSERT INTO meal_plans 
          (user_id, meal_id, week_number, day_of_week, plan_date, slot_type)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [userId, meal_id, week_number, day_of_week, plan_date, slot_type]
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error adding meal plan slot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bulk insert multiple slots (AI-generated plan)
   * payload: array of { meal_id, week_number, day_of_week, plan_date, slot_type }
   */
  static async bulkInsert(userId, slots) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = [];
      for (const slot of slots) {
        const { meal_id, week_number, day_of_week, plan_date, slot_type } = slot;
        const result = await client.query(
          `INSERT INTO meal_plans 
            (user_id, meal_id, week_number, day_of_week, plan_date, slot_type)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [userId, meal_id, week_number, day_of_week, plan_date, slot_type]
        );
        inserted.push(result.rows[0]);
      }
      await client.query("COMMIT");
      return inserted;
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`Error bulk inserting plan slots: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user's plan grouped by week then by day, with meal count per day
   */
  static async getByWeek(userId, weekNumber) {
    try {
      const result = await db.query(
        `SELECT mp.*, m.title as meal_title, m.image_url, m.category,
                m.description, m.preparation_time, m.complexity,
                e.calories, e.protein, e.carbs, e.fats
         FROM meal_plans mp
         LEFT JOIN meals m ON mp.meal_id = m.id
         LEFT JOIN meal_energy e ON m.energy_id = e.id
         WHERE mp.user_id = $1 AND mp.week_number = $2
         ORDER BY mp.week_number, mp.day_of_week, mp.slot_type`,
        [userId, weekNumber]
      );

      const DAY_NAMES = {
        1: "Monday", 2: "Tuesday", 3: "Wednesday",
        4: "Thursday", 5: "Friday", 6: "Saturday", 7: "Sunday"
      };

      // Group by week_number → day_of_week
      const grouped = {};

      for (const row of result.rows) {
        const week = `week_${row.week_number}`;
        const dayNum = row.day_of_week;
        const dayKey = `day_${dayNum}`;

        if (!grouped[week]) {
          grouped[week] = { week_number: row.week_number, days: {} };
        }

        if (!grouped[week].days[dayKey]) {
          grouped[week].days[dayKey] = {
            day_of_week: dayNum,
            day_name: DAY_NAMES[dayNum] || `Day ${dayNum}`,
            meals_count: 0,
            meals: []
          };
        }

        grouped[week].days[dayKey].meals.push(row);
        grouped[week].days[dayKey].meals_count += 1;
      }

      // Convert day maps to sorted arrays
      for (const week of Object.values(grouped)) {
        week.days = Object.values(week.days).sort((a, b) => a.day_of_week - b.day_of_week);
      }

      return grouped;
    } catch (error) {
      logger.error(`Error fetching plan by week: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user's plan by specific day
   */
  static async getByDay(userId, weekNumber, dayOfWeek) {
    try {
      const result = await db.query(
        `SELECT mp.*, m.title as meal_title, m.image_url, m.category,
                m.preparation_time, m.complexity,
                e.calories, e.protein, e.carbs, e.fats
         FROM meal_plans mp
         LEFT JOIN meals m ON mp.meal_id = m.id
         LEFT JOIN meal_energy e ON m.energy_id = e.id
         WHERE mp.user_id = $1 AND mp.week_number = $2 AND mp.day_of_week = $3
         ORDER BY mp.slot_type`,
        [userId, weekNumber, dayOfWeek]
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error fetching plan by day: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a slot: change status, swap meal, or skip
   */
  static async updateSlot(slotId, userId, updateData) {
    const { status, is_skipped, is_swapped, meal_id } = updateData;
    try {
      const result = await db.query(
        `UPDATE meal_plans
         SET status      = COALESCE($1, status),
             is_skipped  = COALESCE($2, is_skipped),
             is_swapped  = COALESCE($3, is_swapped),
             meal_id     = COALESCE($4, meal_id),
             updated_at  = NOW()
         WHERE id = $5 AND user_id = $6
         RETURNING *`,
        [status, is_skipped, is_swapped, meal_id, slotId, userId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error updating meal plan slot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user's plan by category (slot_type)
   * Used for the "Category" tab in the UI
   * @param {number} userId
   * @param {string} category - 'breakfast' | 'lunch' | 'dinner' | 'snack'
   */
  static async getByCategory(userId, category) {
    try {
      const result = await db.query(
        `SELECT mp.*, m.title as meal_title, m.image_url, m.category,
                m.preparation_time, m.complexity,
                e.calories, e.protein, e.carbs, e.fats
         FROM meal_plans mp
         LEFT JOIN meals m ON mp.meal_id = m.id
         LEFT JOIN meal_energy e ON m.energy_id = e.id
         WHERE mp.user_id = $1 AND mp.slot_type = $2
         ORDER BY mp.week_number, mp.day_of_week`,
        [userId, category]
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error fetching plan by category: ${error.message}`);
      throw error;
    }
  }
}

module.exports = MealPlanService;
