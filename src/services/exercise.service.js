const db = require("../config/database");
const logger = require("../utils/logger");
const { validatePaginationParams, generatePagination } = require("../utils/pagination");
const { parseBoolean, buildPartialSearchClause } = require("../utils/partialSearch");
const { getValidatedDateRange, buildTimestampDateRangeFilter } = require("../utils/dateRange");

class ExerciseService {
  /**
   * Get exercise details (Video, Audio, Guide)
   */
  static async findById(id) {
    try {
      const result = await db.query(
        "SELECT * FROM exercises WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error finding exercise by ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * List all exercises with pagination
   */
  static async findAll(options = {}) {
    const {
      page = 1,
      limit = 10,
      category,
      q,
      sort_by = "title",
      sort_order = "asc",
      not_pagination,
    } = options;
    const { start_date, end_date } = getValidatedDateRange(options);

    const disablePagination = parseBoolean(not_pagination, false);
    const { page: pageNum, limit: limitNum, offset } = validatePaginationParams(page, limit);

    const sortColumns = {
      id: "id",
      title: "title",
      category: "category",
      difficulty: "difficulty",
      is_premium: "is_premium",
      duration_seconds: "duration_seconds",
      created_at: "created_at",
    };
    const safeSortBy = sortColumns[String(sort_by || "").toLowerCase()] || "title";
    const safeSortOrder = String(sort_order || "").toLowerCase() === "desc" ? "DESC" : "ASC";

    const whereParts = ["deleted_at IS NULL"];
    const whereParams = [];

    if (category) {
      whereParams.push(category);
      whereParts.push(`category = $${whereParams.length}`);
    }

    const search = buildPartialSearchClause(
      ["title", "description", "category", "target_muscle_group"],
      q,
      whereParams.length + 1
    );
    if (search.clause) {
      whereParts.push(search.clause);
      whereParams.push(...search.params);
    }
    const dateFilter = buildTimestampDateRangeFilter(
      "created_at",
      start_date,
      end_date,
      whereParams.length + 1
    );
    if (dateFilter.clauses.length > 0) {
      whereParts.push(...dateFilter.clauses);
      whereParams.push(...dateFilter.params);
    }

    const whereSql = whereParts.join(" AND ");

    try {
      const countRes = await db.query(`SELECT COUNT(*)::int AS total FROM exercises WHERE ${whereSql}`, whereParams);
      const total = countRes.rows[0]?.total || 0;

      const dataParams = [...whereParams];
      let dataSql = `SELECT * FROM exercises WHERE ${whereSql} ORDER BY ${safeSortBy} ${safeSortOrder}, id DESC`;
      if (!disablePagination) {
        dataParams.push(limitNum, offset);
        dataSql += ` LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;
      }

      const result = await db.query(dataSql, dataParams);

      return {
        exercises: result.rows,
        total,
        ...(disablePagination
          ? {}
          : {
              pagination: {
                ...generatePagination(pageNum, limitNum, total),
                sort_by: Object.keys(sortColumns).find((k) => sortColumns[k] === safeSortBy) || "title",
                sort_order: safeSortOrder.toLowerCase(),
              },
            }),
      };
    } catch (error) {
      logger.error(`Error finding exercises: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new exercise (AI-generated from frontend)
   */
  static async create(exerciseData) {
    const {
      title,
      description,
      video_url,
      thumbnail_url,
      audio_url,
      instructions,
      category,
      target_muscle_group,
      duration_seconds,
      difficulty,
      is_premium,
      default_rest_time_seconds,
    } = exerciseData;

    try {
      const result = await db.query(
        `INSERT INTO exercises (
           title,
           description,
           video_url,
           thumbnail_url,
           audio_url,
           instructions,
           category,
           target_muscle_group,
           duration_seconds,
           difficulty,
           is_premium,
           default_rest_time_seconds
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          title,
          description,
          video_url || null,
          thumbnail_url,
          audio_url,
          instructions || {},
          category,
          target_muscle_group,
          duration_seconds,
          difficulty,
          parseBoolean(is_premium, false),
          default_rest_time_seconds,
        ]
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error creating exercise: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update exercise (partial update)
   */
  static async updateById(id, exerciseData) {
    const {
      title,
      description,
      video_url,
      thumbnail_url,
      audio_url,
      instructions,
      category,
      target_muscle_group,
      duration_seconds,
      difficulty,
      is_premium,
      default_rest_time_seconds,
    } = exerciseData;

    try {
      const result = await db.query(
        `UPDATE exercises
         SET
           title = COALESCE($1, title),
           description = COALESCE($2, description),
           video_url = COALESCE($3, video_url),
           thumbnail_url = COALESCE($4, thumbnail_url),
           audio_url = COALESCE($5, audio_url),
           instructions = COALESCE($6, instructions),
           category = COALESCE($7, category),
           target_muscle_group = COALESCE($8, target_muscle_group),
           duration_seconds = COALESCE($9, duration_seconds),
           difficulty = COALESCE($10, difficulty),
           is_premium = COALESCE($11, is_premium),
           default_rest_time_seconds = COALESCE($12, default_rest_time_seconds),
           updated_at = NOW()
         WHERE id = $13 AND deleted_at IS NULL
         RETURNING *`,
        [
          title ?? null,
          description ?? null,
          video_url ?? null,
          thumbnail_url ?? null,
          audio_url ?? null,
          instructions ?? null,
          category ?? null,
          target_muscle_group ?? null,
          duration_seconds ?? null,
          difficulty ?? null,
          is_premium !== undefined ? parseBoolean(is_premium, false) : null,
          default_rest_time_seconds ?? null,
          id,
        ]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error updating exercise: ${error.message}`);
      throw error;
    }
  }

  /**
   * Soft delete exercise and detach it from workouts
   */
  static async deleteById(id) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const deletedExercise = await client.query(
        `UPDATE exercises
         SET deleted_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING *`,
        [id]
      );

      if (!deletedExercise.rows[0]) {
        await client.query("ROLLBACK");
        return null;
      }

      await client.query("DELETE FROM workout_exercises WHERE exercise_id = $1", [id]);

      await client.query("COMMIT");
      return deletedExercise.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`Error deleting exercise: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = ExerciseService;
