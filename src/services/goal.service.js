const db = require("../config/database");
const logger = require("../utils/logger");
const { validatePaginationParams, generatePagination } = require("../utils/pagination");
const { normalizeSearchTerm } = require("../utils/partialSearch");
const { buildTimestampDateRangeFilter } = require("../utils/dateRange");

class GoalService {
  static async listActive(options = {}) {
    const {
      page = 1,
      limit = 10,
      q,
      sort_by = "created_at",
      sort_order = "desc",
      start_date,
      end_date,
    } = options;
    const { page: pageNum, limit: limitNum, offset } = validatePaginationParams(page, limit);
    const searchTerm = normalizeSearchTerm(q);

    const safeSortMap = {
      id: "id",
      title: "title",
      plan_duration: "plan_duration",
      goal_weight: "goal_weight",
      created_at: "created_at",
      updated_at: "updated_at",
    };
    const requestedSort = String(sort_by || "").toLowerCase();
    const effectiveSort = safeSortMap[requestedSort] || "created_at";
    const sortDir = String(sort_order || "").toLowerCase() === "asc" ? "ASC" : "DESC";

    try {
      const where = ["deleted_at IS NULL"];
      const params = [];
      if (searchTerm) {
        params.push(`%${searchTerm}%`);
        where.push(`(title ILIKE $${params.length} OR description ILIKE $${params.length})`);
      }
      const dateFilter = buildTimestampDateRangeFilter(
        "created_at",
        start_date,
        end_date,
        params.length + 1
      );
      if (dateFilter.clauses.length > 0) {
        where.push(...dateFilter.clauses);
        params.push(...dateFilter.params);
      }
      const whereSql = `WHERE ${where.join(" AND ")}`;

      const countRes = await db.query(
        `SELECT COUNT(*)::int AS total
         FROM goals
         ${whereSql}`,
        params
      );

      const queryParams = [...params, limitNum, offset];
      const result = await db.query(
        `SELECT id, title, description, image_url AS image, plan_duration, goal_weight, created_at, updated_at
         FROM goals
         ${whereSql}
         ORDER BY ${effectiveSort} ${sortDir}, id DESC
         LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
        queryParams
      );
      const total = countRes.rows[0]?.total || 0;
      return {
        goals: result.rows,
        pagination: {
          ...generatePagination(pageNum, limitNum, total),
          sort_by: Object.keys(safeSortMap).find((k) => safeSortMap[k] === effectiveSort) || "created_at",
          sort_order: sortDir.toLowerCase(),
        },
      };
    } catch (error) {
      logger.error(`Error listing goals: ${error.message}`);
      throw error;
    }
  }

  static async getActiveById(id) {
    try {
      const result = await db.query(
        `SELECT id, title, description, image_url AS image, plan_duration, goal_weight, created_at, updated_at
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
    const {
      title,
      description = null,
      image = null,
      plan_duration = null,
      goal_weight = null,
    } = payload;
    try {
      const result = await db.query(
        `INSERT INTO goals (title, description, image_url, plan_duration, goal_weight)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, title, description, image_url AS image, plan_duration, goal_weight, created_at, updated_at`,
        [title, description, image, plan_duration, goal_weight]
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error creating goal: ${error.message}`);
      throw error;
    }
  }

  static async update(id, payload) {
    const { title, description, image, plan_duration, goal_weight } = payload;
    try {
      const result = await db.query(
        `UPDATE goals
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             image_url = COALESCE($3, image_url),
             plan_duration = COALESCE($4, plan_duration),
             goal_weight = COALESCE($5, goal_weight),
             updated_at = NOW()
         WHERE id = $6 AND deleted_at IS NULL
         RETURNING id, title, description, image_url AS image, plan_duration, goal_weight, created_at, updated_at`,
        [title, description, image, plan_duration, goal_weight, id]
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

  static async getByUserId(userId, options = {}) {
    const { start_date, end_date } = options;
    try {
      const params = [userId];
      const where = ["p.user_id = $1", "p.deleted_at IS NULL"];
      const dateFilter = buildTimestampDateRangeFilter(
        "p.created_at",
        start_date,
        end_date,
        params.length + 1
      );
      if (dateFilter.clauses.length > 0) {
        where.push(...dateFilter.clauses);
        params.push(...dateFilter.params);
      }
      const result = await db.query(
        `SELECT
           p.user_id,
           p.goal_id,
           p.created_at,
           g.title,
           g.description,
           g.image_url AS image,
           g.plan_duration,
           g.goal_weight
         FROM profiles p
         LEFT JOIN goals g ON g.id = p.goal_id AND g.deleted_at IS NULL
         WHERE ${where.join(" AND ")}
         ORDER BY p.created_at DESC
         LIMIT 1`,
        params
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error getting goal by user id: ${error.message}`);
      throw error;
    }
  }
}

module.exports = GoalService;
