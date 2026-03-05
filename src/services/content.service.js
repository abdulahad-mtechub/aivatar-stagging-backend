const db = require("../config/database");
const logger = require("../utils/logger");

/**
 * Content Service - handles content management operations (Privacy Policy, Terms, etc.)
 */
class ContentService {
  /**
   * Upsert content (create if not exists, update if exists)
   * @param {string} type - Content type (e.g., 'privacy_policy')
   * @param {string} content - The actual content string
   * @param {boolean} status - Active status
   * @returns {Promise<object>} The upserted content record
   */
  static async upsert(type, content, status = true) {
    try {
      const query = `
        INSERT INTO contentmanagement (type, content, status, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (type) 
        DO UPDATE SET 
          content = EXCLUDED.content, 
          status = EXCLUDED.status, 
          updated_at = NOW()
        RETURNING *
      `;
      const result = await db.query(query, [type, content, status]);
      return result.rows[0];
    } catch (error) {
      logger.error(`Error upserting content: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find content by type
   * @param {string} type - Content type
   * @returns {Promise<object|null>} Content record or null if not found
   */
  static async findByType(type) {
    try {
      const result = await db.query(
        "SELECT * FROM contentmanagement WHERE type = $1 AND status = true",
        [type]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error finding content by type: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ContentService;
