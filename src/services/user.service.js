const db = require("../config/database");
const logger = require("../utils/logger");

/**
 * User Service - handles user-related database operations
 */
class UserService {
  /**
   * Find a user by email
   * @param {string} email - User's email address
   * @returns {Promise<object|null>} User object or null if not found
   */
  static async findByEmail(email) {
    try {
      const result = await db.query(
        "SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL",
        [email]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error finding user by email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find a user by ID
   * @param {number} id - User ID
   * @returns {Promise<object|null>} User object or null if not found
   */
  static async findById(id) {
    try {
      const result = await db.query(
        "SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error finding user by ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new user
   * @param {object} userData - User data
   * @returns {Promise<object>} Created user object
   */
  static async create(userData) {
    const { name, email, password, role = "user" } = userData;

    try {
      const result = await db.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *",
        [name, email, password, role]
      );

      return result.rows[0];
    } catch (error) {
      logger.error(`Error creating user: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a user
   * @param {number} id - User ID
   * @param {object} updateData - Data to update
   * @returns {Promise<object|null>} Updated user object or null if not found
   */
  static async update(id, updateData) {
    // Filter to only allow certain fields to be updated
    const allowedFields = [
      "name",
      "email",
      "phone_number",
      "profile_image",
      "block_status",
    ];
    const updates = Object.keys(updateData)
      .filter(
        (key) => allowedFields.includes(key) && updateData[key] !== undefined
      )
      .map((key, index) => `${key} = $${index + 2}`);

    if (updates.length === 0) return null;

    // Add timestamp
    updates.push("updated_at = NOW()");

    // Get values for the query
    const values = [
      id,
      ...Object.keys(updateData)
        .filter(
          (key) => allowedFields.includes(key) && updateData[key] !== undefined
        )
        .map((key) => updateData[key]),
    ];

    try {
      const result = await db.query(
        `UPDATE users SET ${updates.join(", ")} WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
        values
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error updating user: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a user (soft delete)
   * @param {number} id - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(id) {
    try {
      await db.query(
        "UPDATE users SET deleted_at = NOW() WHERE id = $1",
        [id]
      );

      return true;
    } catch (error) {
      logger.error(`Error deleting user: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all users with pagination
   * @param {object} options - Pagination options
   * @returns {Promise<object>} Users and pagination info
   */
  static async findAll(options = {}) {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    try {
      // Get total count
      const countResult = await db.query(
        "SELECT COUNT(*) FROM users WHERE deleted_at IS NULL"
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Get users
      const result = await db.query(
        "SELECT id, name, email, role, block_status, created_at, updated_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        [limit, offset]
      );

      return {
        users: result.rows,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error(`Error finding all users: ${error.message}`);
      throw error;
    }
  }
}

module.exports = UserService;

