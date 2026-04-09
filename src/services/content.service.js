const db = require("../config/database");
const logger = require("../utils/logger");

/**
 * Content Service - handles content management operations (Privacy Policy, Terms, etc.)
 */
class ContentService {
  /**
   * Create a new content version.
   * @param {string} type - Content type (e.g., 'privacy_policy')
   * @param {string} content - The actual content string
   * @param {boolean} status - Active status
   * @returns {Promise<object>} The created content version
   */
  static async createVersion(type, content, status = true) {
    const client = await db.pool.connect();
    try {
      const isActive = status === true || String(status).toLowerCase() === "true";
      await client.query("BEGIN");

      if (isActive) {
        await client.query(
          `UPDATE contentmanagement
           SET status = false, updated_at = NOW()
           WHERE type = $1::varchar AND status = true`,
          [type]
        );
      }

      const createRes = await client.query(
        `INSERT INTO contentmanagement (type, content, status, version, activated_at, updated_at)
         VALUES (
           $1::varchar,
           $2::text,
           $3::boolean,
           COALESCE((SELECT MAX(version) + 1 FROM contentmanagement WHERE type = $4::varchar), 1),
           CASE WHEN $3::boolean = true THEN NOW() ELSE NULL END,
           NOW()
         )
         RETURNING *`,
        [type, content, isActive, type]
      );

      const result = await client.query(
        `SELECT * FROM contentmanagement WHERE id = $1`,
        [createRes.rows[0].id]
      );
      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`Error creating content version: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find active content by type
   * @param {string} type - Content type
   * @returns {Promise<object|null>} Content record or null if not found
   */
  static async findActiveByType(type) {
    try {
      const result = await db.query(
        "SELECT * FROM contentmanagement WHERE type = $1 AND status = true ORDER BY version DESC LIMIT 1",
        [type]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error finding active content by type: ${error.message}`);
      throw error;
    }
  }

  /**
   * List content versions by type (admin)
   */
  static async listVersionsByType(type) {
    try {
      const result = await db.query(
        `SELECT * FROM contentmanagement
         WHERE type = $1
         ORDER BY version DESC, created_at DESC`,
        [type]
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error listing content versions by type: ${error.message}`);
      throw error;
    }
  }

  /**
   * Activate a specific content version (admin)
   */
  static async activateVersion(id) {
    try {
      const rowRes = await db.query(
        `SELECT id, type FROM contentmanagement WHERE id = $1 LIMIT 1`,
        [id]
      );
      const target = rowRes.rows[0];
      if (!target) return null;

      await db.query(
        `UPDATE contentmanagement
         SET status = false, updated_at = NOW()
         WHERE type = $1 AND status = true`,
        [target.type]
      );
      const result = await db.query(
        `UPDATE contentmanagement
         SET status = true, activated_at = NOW(), updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error activating content version: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ContentService;
