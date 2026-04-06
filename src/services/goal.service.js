const db = require("../config/database");
const logger = require("../utils/logger");

class GoalService {
  static async listActive() {
    try {
      const result = await db.query(
        `SELECT id, title, description, plan_duration, goal_weight, created_at, updated_at
         FROM goals
         WHERE deleted_at IS NULL
         ORDER BY id ASC`
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error listing goals: ${error.message}`);
      throw error;
    }
  }

  static async getActiveById(id) {
    try {
      const result = await db.query(
        `SELECT id, title, description, plan_duration, goal_weight, created_at, updated_at
         FROM goals
         WHERE id = $1 AND deleted_at IS NULL
         LIMIT 1`,
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error getting goal by id: ${error.message}`);
      throw error;
    }
  }

  static async create(payload) {
    const { title, description = null, plan_duration = null, goal_weight = null } = payload;
    try {
      const result = await db.query(
        `INSERT INTO goals (title, description, plan_duration, goal_weight)
         VALUES ($1, $2, $3, $4)
         RETURNING id, title, description, plan_duration, goal_weight, created_at, updated_at`,
        [title, description, plan_duration, goal_weight]
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error creating goal: ${error.message}`);
      throw error;
    }
  }

  static async update(id, payload) {
    const { title, description, plan_duration, goal_weight } = payload;
    try {
      const result = await db.query(
        `UPDATE goals
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             plan_duration = COALESCE($3, plan_duration),
             goal_weight = COALESCE($4, goal_weight),
             updated_at = NOW()
         WHERE id = $5 AND deleted_at IS NULL
         RETURNING id, title, description, plan_duration, goal_weight, created_at, updated_at`,
        [title, description, plan_duration, goal_weight, id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error updating goal: ${error.message}`);
      throw error;
    }
  }

  static async softDelete(id) {
    try {
      const result = await db.query(
        `UPDATE goals
         SET deleted_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING id`,
        [id]
      );
      return result.rowCount > 0;
    } catch (error) {
      logger.error(`Error deleting goal: ${error.message}`);
      throw error;
    }
  }
  static async getByUserId(userId) {
    try {
      const result = await db.query(
        `SELECT g.id, g.title, g.description, g.plan_duration, g.goal_weight, g.created_at, g.updated_at
         FROM profiles p
         JOIN goals g ON g.id = p.goal_id
         WHERE p.user_id = $1 AND g.deleted_at IS NULL
         LIMIT 1`,
        [userId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error getting goal by user id: ${error.message}`);
      throw error;
    }
  }
}

module.exports = GoalService;
