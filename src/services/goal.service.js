const db = require("../config/database");
const logger = require("../utils/logger");
const { validatePaginationParams, generatePagination } = require("../utils/pagination");
const { normalizeSearchTerm } = require("../utils/partialSearch");

class GoalService {
  static async listActive(options = {}) {
    const {
      page = 1,
      limit = 10,
      q,
      sort_by = "created_at",
      sort_order = "desc",
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
      const whereSql = `WHERE ${where.join(" AND ")}`;

      const countRes = await db.query(
        `SELECT COUNT(*)::int AS total
         FROM goals
         ${whereSql}`,
        params
      );

      const queryParams = [...params, limitNum, offset];
      const result = await db.query(
        `SELECT id, title, description, plan_duration, goal_weight, created_at, updated_at
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
}

module.exports = GoalService;
