const db = require("../config/database");
const logger = require("../utils/logger");
const { validatePaginationParams, generatePagination } = require("../utils/pagination");
const { normalizeSearchTerm } = require("../utils/partialSearch");

/**
 * Contact Service - handles contact query database operations
 */
class ContactService {
  /**
   * Create a new contact query
   * @param {object} contactData - Contact data (name, email, query)
   * @returns {Promise<object>} Created contact object
   */
  static async create(contactData) {
    const { name, email, query } = contactData;

    try {
      const result = await db.query(
        "INSERT INTO contact_us (name, email, query) VALUES ($1, $2, $3) RETURNING *",
        [name, email, query]
      );

      return result.rows[0];
    } catch (error) {
      logger.error(`Error creating contact query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all contact queries with pagination
   * @param {object} options - Pagination options
   * @returns {Promise<object>} Contact queries and pagination info
   */
  static async findAll(options = {}) {
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
      name: "name",
      email: "email",
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
        where.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length} OR query ILIKE $${params.length})`);
      }
      const whereSql = `WHERE ${where.join(" AND ")}`;

      // Get total count
      const countResult = await db.query(
        `SELECT COUNT(*)::int AS total FROM contact_us ${whereSql}`,
        params
      );
      const total = countResult.rows[0]?.total || 0;

      // Get queries
      const queryParams = [...params, limitNum, offset];
      const result = await db.query(
        `SELECT * FROM contact_us
         ${whereSql}
         ORDER BY ${effectiveSort} ${sortDir}, id DESC
         LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
        queryParams
      );

      return {
        contacts: result.rows,
        pagination: {
          ...generatePagination(pageNum, limitNum, total),
          sort_by: Object.keys(safeSortMap).find((k) => safeSortMap[k] === effectiveSort) || "created_at",
          sort_order: sortDir.toLowerCase(),
        },
      };
    } catch (error) {
      logger.error(`Error finding all contact queries: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ContactService;
