const db = require("../config/database");
const logger = require("../utils/logger");
const AppError = require("../utils/appError");

function isUniqueTitleViolation(error) {
  return error && error.code === "23505";
}

/** Same normalization as DB index uq_badges_title_normalized */
function normalizeBadgeTitle(title) {
  return String(title ?? "").trim().toLowerCase();
}

/**
 * BadgeService - handles badge management and user badge assignment
 */
class BadgeService {
  /**
   * Get all badges (user-facing)
   */
  static async getAllBadges() {
    try {
      const result = await db.query("SELECT * FROM badges ORDER BY max_points ASC");
      return result.rows;
    } catch (error) {
      logger.error(`Error getting all badges: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a badge (Admin)
   */
  static async createBadge(data) {
    const { title, max_points, badge_image, color, color_value } = data;
    const key = normalizeBadgeTitle(title);
    if (!key) {
      throw new AppError("Badge title is required", 400);
    }
    try {
      const dup = await db.query(
        `SELECT id FROM badges WHERE LOWER(TRIM(title)) = $1 LIMIT 1`,
        [key]
      );
      if (dup.rows.length > 0) {
        throw new AppError(`A badge with title "${title}" already exists`, 400);
      }
      const result = await db.query(
        `INSERT INTO badges (title, max_points, badge_image, color, color_value) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [title, max_points, badge_image, color, color_value]
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error creating badge: ${error.message}`);
      if (isUniqueTitleViolation(error)) {
        throw new AppError(`A badge with title "${title}" already exists`, 400);
      }
      throw error;
    }
  }

  /**
   * Update a badge (Admin)
   */
  static async updateBadge(id, data) {
    const { title, max_points, badge_image, color, color_value } = data;
    try {
      if (title !== undefined && title !== null) {
        const key = normalizeBadgeTitle(title);
        if (!key) {
          throw new AppError("Badge title cannot be empty", 400);
        }
        const dup = await db.query(
          `SELECT id FROM badges WHERE LOWER(TRIM(title)) = $1 AND id != $2 LIMIT 1`,
          [key, id]
        );
        if (dup.rows.length > 0) {
          throw new AppError(`A badge with title "${title}" already exists`, 400);
        }
      }
      const result = await db.query(
        `UPDATE badges SET
          title = COALESCE($1, title),
          max_points = COALESCE($2, max_points),
          badge_image = COALESCE($3, badge_image),
          color = COALESCE($4, color),
          color_value = COALESCE($5, color_value),
          updated_at = NOW()
         WHERE id = $6 RETURNING *`,
        [title, max_points, badge_image, color, color_value, id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error updating badge: ${error.message}`);
      if (isUniqueTitleViolation(error)) {
        throw new AppError(
          title !== undefined && title !== null
            ? `A badge with title "${title}" already exists`
            : "Badge title must be unique",
          400
        );
      }
      throw error;
    }
  }

  /**
   * Delete a badge (Admin)
   */
  static async deleteBadge(id) {
    try {
      const result = await db.query("DELETE FROM badges WHERE id = $1 RETURNING *", [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error deleting badge: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user's active badge based on their current balance
   * Finds the highest badge with max_points <= user's current balance
   */
  static async getUserActiveBadge(currentBalance) {
    try {
      const result = await db.query(
        `SELECT * FROM badges 
         WHERE max_points <= $1 
         ORDER BY max_points DESC 
         LIMIT 1`,
        [currentBalance]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error getting user active badge: ${error.message}`);
      throw error;
    }
  }
}

module.exports = BadgeService;
