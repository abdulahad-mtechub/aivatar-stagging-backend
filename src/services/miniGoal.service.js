const db = require("../config/database");
const logger = require("../utils/logger");
const RewardService = require("./reward.service");
const AppError = require("../utils/appError");

class MiniGoalService {
  static async create(userId, data) {
    const { title, description, start_date, end_date, type, rule_id } = data;
    try {
      const result = await db.query(
        `INSERT INTO mini_goals (user_id, title, description, start_date, end_date, type, rule_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [userId, title, description, start_date, end_date, type || "custom", rule_id]
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error creating mini goal: ${error.message}`);
      throw error;
    }
  }

  static async listByUser(userId) {
    try {
      const result = await db.query(
        "SELECT * FROM mini_goals WHERE user_id = $1 ORDER BY created_at DESC",
        [userId]
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error listing mini goals: ${error.message}`);
      throw error;
    }
  }

  static async getById(userId, goalId) {
    try {
      const result = await db.query(
        "SELECT * FROM mini_goals WHERE id = $1 AND user_id = $2",
        [goalId, userId]
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error getting mini goal: ${error.message}`);
      throw error;
    }
  }

  static async updateStatus(userId, goalId, status) {
    try {
      const goal = await this.getById(userId, goalId);
      if (!goal) throw new AppError("Mini goal not found", 404);

      if (goal.status === "completed") {
        throw new AppError("Mini goal is already completed", 400);
      }

      const result = await db.query(
        "UPDATE mini_goals SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *",
        [status, goalId, userId]
      );

      const updatedGoal = result.rows[0];

      // Award points if completed
      if (status === "completed" && updatedGoal.rule_id) {
        try {
          const earning = await RewardService.earnPoints(userId, updatedGoal.rule_id);
          await db.query(
            "UPDATE mini_goals SET points_awarded = $1 WHERE id = $2",
            [earning.points, goalId]
          );
          updatedGoal.points_awarded = earning.points;
        } catch (rewardError) {
          logger.warn(`Failed to award points for mini goal ${goalId}: ${rewardError.message}`);
        }
      }

      return updatedGoal;
    } catch (error) {
      logger.error(`Error updating mini goal status: ${error.message}`);
      throw error;
    }
  }

  static async delete(userId, goalId) {
    try {
      const result = await db.query(
        "DELETE FROM mini_goals WHERE id = $1 AND user_id = $2 RETURNING *",
        [goalId, userId]
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error deleting mini goal: ${error.message}`);
      throw error;
    }
  }
}

module.exports = MiniGoalService;
