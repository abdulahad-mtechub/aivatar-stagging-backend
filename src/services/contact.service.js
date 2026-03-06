const db = require("../config/database");
const logger = require("../utils/logger");

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
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    try {
      // Get total count
      const countResult = await db.query(
        "SELECT COUNT(*) FROM contact_us WHERE deleted_at IS NULL"
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Get queries
      const result = await db.query(
        "SELECT * FROM contact_us WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        [limit, offset]
      );

      return {
        contacts: result.rows,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error(`Error finding all contact queries: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ContactService;
