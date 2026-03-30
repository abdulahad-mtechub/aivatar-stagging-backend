const db = require("../config/database");
const logger = require("../utils/logger");
const { validatePaginationParams, generatePagination } = require("../utils/pagination");
const { parseBoolean, buildPartialSearchClause } = require("../utils/partialSearch");

class DemoVideoService {
  static async listActive() {
    try {
      const result = await db.query(
        `SELECT id, title, description, video_url, image_url, is_active, created_at, updated_at
         FROM demo_videos
         WHERE is_active = TRUE
         ORDER BY created_at DESC`
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error listing active demo videos: ${error.message}`);
      throw error;
    }
  }

  static async findActiveById(id) {
    try {
      const result = await db.query(
        `SELECT id, title, description, video_url, image_url, is_active, created_at, updated_at
         FROM demo_videos
         WHERE id = $1 AND is_active = TRUE`,
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error finding active demo video: ${error.message}`);
      throw error;
    }
  }

  static async listAllForAdmin(options = {}) {
    const {
      page = 1,
      limit = 10,
      q,
      sort_by = "created_at",
      sort_order = "desc",
      not_pagination,
    } = options;
    const disablePagination = parseBoolean(not_pagination, false);
    const { page: pageNum, limit: limitNum, offset } = validatePaginationParams(page, limit);

    const sortColumns = {
      id: "id",
      title: "title",
      is_active: "is_active",
      created_at: "created_at",
      updated_at: "updated_at",
    };
    const safeSortBy = sortColumns[String(sort_by || "").toLowerCase()] || "created_at";
    const safeSortOrder = String(sort_order || "").toLowerCase() === "asc" ? "ASC" : "DESC";

    try {
      const search = buildPartialSearchClause(["title", "description"], q, 1);
      const whereSql = search.clause ? `WHERE ${search.clause}` : "";

      const countRes = await db.query(
        `SELECT COUNT(*)::int AS total FROM demo_videos ${whereSql}`,
        search.params
      );
      const total = countRes.rows[0]?.total || 0;

      const params = [...search.params];
      let paginationSql = "";
      if (!disablePagination) {
        params.push(limitNum, offset);
        paginationSql = ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
      }

      const result = await db.query(
        `SELECT id, title, description, video_url, image_url, is_active, created_at, updated_at
         FROM demo_videos
         ${whereSql}
         ORDER BY ${safeSortBy} ${safeSortOrder}, id DESC
         ${paginationSql}`,
        params
      );
      return {
        videos: result.rows,
        ...(disablePagination
          ? {}
          : {
              pagination: {
                ...generatePagination(pageNum, limitNum, total),
                sort_by: Object.keys(sortColumns).find((k) => sortColumns[k] === safeSortBy) || "created_at",
                sort_order: safeSortOrder.toLowerCase(),
              },
            }),
      };
    } catch (error) {
      logger.error(`Error listing demo videos for admin: ${error.message}`);
      throw error;
    }
  }

  static async findByIdForAdmin(id) {
    try {
      const result = await db.query(
        `SELECT id, title, description, video_url, image_url, is_active, created_at, updated_at
         FROM demo_videos WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error finding demo video by id: ${error.message}`);
      throw error;
    }
  }

  static async create(data) {
    const { title, description, video_url, image_url, is_active } = data;
    try {
      const result = await db.query(
        `INSERT INTO demo_videos (title, description, video_url, image_url, is_active, updated_at)
         VALUES ($1, $2, $3, $4, COALESCE($5, TRUE), NOW())
         RETURNING *`,
        [title, description ?? null, video_url, image_url ?? null, is_active]
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error creating demo video: ${error.message}`);
      throw error;
    }
  }

  static async update(id, data) {
    try {
      const existing = await this.findByIdForAdmin(id);
      if (!existing) return null;

      const title = data.title !== undefined ? data.title : existing.title;
      const description =
        data.description !== undefined ? data.description : existing.description;
      const video_url = data.video_url !== undefined ? data.video_url : existing.video_url;
      const image_url = data.image_url !== undefined ? data.image_url : existing.image_url;
      const is_active = data.is_active !== undefined ? data.is_active : existing.is_active;

      const result = await db.query(
        `UPDATE demo_videos SET
          title = $1,
          description = $2,
          video_url = $3,
          image_url = $4,
          is_active = $5,
          updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [title, description, video_url, image_url, is_active, id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error updating demo video: ${error.message}`);
      throw error;
    }
  }

  static async delete(id) {
    try {
      const result = await db.query("DELETE FROM demo_videos WHERE id = $1 RETURNING *", [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error deleting demo video: ${error.message}`);
      throw error;
    }
  }
}

module.exports = DemoVideoService;
