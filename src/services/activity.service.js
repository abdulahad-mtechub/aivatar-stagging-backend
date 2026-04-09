const db = require("../config/database");
const logger = require("../utils/logger");
const { buildTimestampDateRangeFilter } = require("../utils/dateRange");

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
    start_date,
    end_date,
  }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const validSort = ["ASC", "DESC"];
    const sortOrder = validSort.includes(String(sort_by).toUpperCase())
      ? String(sort_by).toUpperCase()
      : "DESC";

    let whereClause = "WHERE a.user_id = $1";
    const params = [user_id];
    if (action_type) {
      whereClause += ` AND a.action_type = $2`;
      params.push(action_type);
    }
    const dateFilter = buildTimestampDateRangeFilter(
      "a.created_at",
      start_date,
      end_date,
      params.length + 1
    );
    if (dateFilter.clauses.length > 0) {
      whereClause += ` AND ${dateFilter.clauses.join(" AND ")}`;
      params.push(...dateFilter.params);
    }

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM activity_log a
      ${whereClause}
    `;

    const selectQuery = `
      SELECT
        a.id,
        a.user_id,
        a.module_key,
        a.description,
        a.action_type,
        a.created_at,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email,
          'phone_number', u.phone_number,
          'role', u.role,
          'is_verified', u.is_verified,
          'block_status', u.block_status,
          'profile_image', COALESCE(p.profile_image, u.profile_image)
        ) AS user,
        json_build_object(
          'id', p.id,
          'user_id', p.user_id,
          'profile_image', p.profile_image,
          'address', p.address,
          'reminder', p.reminder,
          'plan_key', p.plan_key,
          'goal_id', p.goal_id,
          'mentor_gender', p.mentor_gender,
          'gender', p.gender,
          'qa_list', p.qa_list,
          'job_type', p.job_type,
          'target_calories', p.target_calories,
          'target_protein', p.target_protein,
          'target_carbs', p.target_carbs,
          'target_fats', p.target_fats,
          'target_weight', p.target_weight
        ) AS user_profile
      FROM activity_log a
      JOIN users u ON u.id = a.user_id
      LEFT JOIN profiles p ON p.user_id = u.id
      ${whereClause}
      ORDER BY a.created_at ${sortOrder}
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

  static async getLastWeekOverallLogs({
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

    let whereClause = "WHERE a.created_at >= NOW() - INTERVAL '7 days'";
    const params = [];
    if (action_type) {
      whereClause += ` AND a.action_type = $1`;
      params.push(action_type);
    }

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM activity_log a
      ${whereClause}
    `;

    const selectQuery = `
      SELECT
        a.id,
        a.user_id,
        a.module_key,
        a.description,
        a.action_type,
        a.created_at,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email,
          'phone_number', u.phone_number,
          'role', u.role,
          'is_verified', u.is_verified,
          'block_status', u.block_status,
          'profile_image', COALESCE(p.profile_image, u.profile_image)
        ) AS user,
        json_build_object(
          'id', p.id,
          'user_id', p.user_id,
          'profile_image', p.profile_image,
          'address', p.address,
          'reminder', p.reminder,
          'plan_key', p.plan_key,
          'goal_id', p.goal_id,
          'mentor_gender', p.mentor_gender,
          'gender', p.gender,
          'qa_list', p.qa_list,
          'job_type', p.job_type,
          'target_calories', p.target_calories,
          'target_protein', p.target_protein,
          'target_carbs', p.target_carbs,
          'target_fats', p.target_fats,
          'target_weight', p.target_weight
        ) AS user_profile
      FROM activity_log a
      JOIN users u ON u.id = a.user_id
      LEFT JOIN profiles p ON p.user_id = u.id
      ${whereClause}
      ORDER BY a.created_at ${sortOrder}
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

