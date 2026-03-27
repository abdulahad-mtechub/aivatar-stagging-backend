const db = require("../config/database");
const logger = require("../utils/logger");

class ActivityService {
  static async recordActivity({ user_id, module_key, description = "", action_type }) {
    try {
      const now = new Date();
      const result = await db.query(
        `INSERT INTO activity_log (user_id, module_key, description, action_type, created_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id, module_key, description, action_type, created_at`,
        [user_id, module_key, description || "", action_type, now]
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error recording activity: ${error.message}`);
      throw error;
    }
  }

  static async getActivityLogsByUser({
    user_id,
    action_type,
    sort_by = "DESC",
    page = 1,
    limit = 10,
  }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const validSort = ["ASC", "DESC"];
    const sortOrder = validSort.includes(String(sort_by).toUpperCase())
      ? String(sort_by).toUpperCase()
      : "DESC";

    let whereClause = "WHERE user_id = $1";
    const params = [user_id];
    if (action_type) {
      whereClause += ` AND action_type = $2`;
      params.push(action_type);
    }

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM activity_log
      ${whereClause}
    `;

    const selectQuery = `
      SELECT id, user_id, module_key, description, action_type, created_at
      FROM activity_log
      ${whereClause}
      ORDER BY created_at ${sortOrder}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const [countRes, dataRes] = await Promise.all([
      db.query(countQuery, params),
      db.query(selectQuery, [...params, limitNum, offset]),
    ]);

    const total = parseInt(countRes.rows[0]?.total || "0", 10);
    const totalPages = Math.ceil(total / limitNum);

    return {
      activities: dataRes.rows || [],
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalRecords: total,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1,
      },
    };
  }
}

module.exports = ActivityService;

