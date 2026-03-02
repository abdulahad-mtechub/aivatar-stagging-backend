const db = require("../config/database");
const logger = require("../utils/logger");

/**
 * Profile Service - handles profile-related database operations
 * The profiles table is 1-to-1 with users (unique user_id constraint).
 * profile_image and profile_field store Cloudinary URLs supplied by the frontend.
 */
class ProfileService {
    /**
     * Create a new profile for a user.
     * @param {object} profileData
     * @returns {Promise<object>} Created profile row
     */
    static async create(profileData) {
        const { user_id, profile_image, reminder, plan_key, goal_id, mentor_gender, gender, qa_list, job_type } = profileData;

        try {
            const result = await db.query(
                `INSERT INTO profiles
           (user_id, profile_image, reminder, plan_key, goal_id, mentor_gender, gender, qa_list, job_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
                [
                    user_id,
                    profile_image || null,
                    reminder || null,
                    plan_key || null,
                    goal_id || null,
                    mentor_gender || null,
                    gender || null,
                    qa_list ? JSON.stringify(qa_list) : '[]',
                    job_type || null,
                ]
            );

            return result.rows[0];
        } catch (error) {
            logger.error(`Error creating profile: ${error.message}`);
            throw error;
        }
    }

    /**
     * Find a profile by user ID (joins goal title for convenience).
     * @param {number} userId
     * @returns {Promise<object|null>}
     */
    static async findByUserId(userId) {
        try {
            const result = await db.query(
                `SELECT p.*, g.title AS goal_title, g.description AS goal_description
         FROM profiles p
         LEFT JOIN goals g ON g.id = p.goal_id AND g.deleted_at IS NULL
         WHERE p.user_id = $1 AND p.deleted_at IS NULL`,
                [userId]
            );

            return result.rows[0] || null;
        } catch (error) {
            logger.error(`Error finding profile by user ID: ${error.message}`);
            throw error;
        }
    }

    /**
     * Find a profile by profile ID.
     * @param {number} id
     * @returns {Promise<object|null>}
     */
    static async findById(id) {
        try {
            const result = await db.query(
                `SELECT p.*, g.title AS goal_title, g.description AS goal_description
         FROM profiles p
         LEFT JOIN goals g ON g.id = p.goal_id AND g.deleted_at IS NULL
         WHERE p.id = $1 AND p.deleted_at IS NULL`,
                [id]
            );

            return result.rows[0] || null;
        } catch (error) {
            logger.error(`Error finding profile by ID: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update a profile by profile ID.
     * Only allows updating permitted fields.
     * @param {number} id - Profile ID
     * @param {object} updateData
     * @returns {Promise<object|null>} Updated profile row or null
     */
    static async update(id, updateData) {
        const allowedFields = ["profile_image", "reminder", "plan_key", "goal_id", "mentor_gender", "gender", "qa_list", "job_type"];

        // Ensure qa_list is serialized to JSON text for the DB; controller attempts to normalize it,
        // but handle final serialization here for safety.
        if (updateData.qa_list !== undefined) {
            if (typeof updateData.qa_list !== 'string') {
                try {
                    updateData.qa_list = JSON.stringify(updateData.qa_list);
                } catch (err) {
                    // Let DB/client see a clear error when serialization fails
                    throw new Error('Invalid qa_list format');
                }
            }
        }

        const filteredKeys = Object.keys(updateData).filter(
            (key) => allowedFields.includes(key) && updateData[key] !== undefined
        );

        if (filteredKeys.length === 0) return null;

        const updateClauses = filteredKeys.map((key, idx) => `${key} = $${idx + 2}`);
        updateClauses.push("updated_at = NOW()");

        const values = [id, ...filteredKeys.map((key) => updateData[key])];

        try {
            const result = await db.query(
                `UPDATE profiles SET ${updateClauses.join(", ")}
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING *`,
                values
            );

            return result.rows[0] || null;
        } catch (error) {
            logger.error(`Error updating profile: ${error.message}`);
            throw error;
        }
    }

    /**
     * Soft-delete a profile by profile ID.
     * @param {number} id
     * @returns {Promise<boolean>}
     */
    static async delete(id) {
        try {
            await db.query(
                "UPDATE profiles SET deleted_at = NOW() WHERE id = $1",
                [id]
            );

            return true;
        } catch (error) {
            logger.error(`Error deleting profile: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all profiles with pagination.
     * @param {object} options - { page, limit }
     * @returns {Promise<object>}
     */
    static async findAll(options = {}) {
        const { page = 1, limit = 10 } = options;
        const offset = (page - 1) * limit;

        try {
            const countResult = await db.query(
                "SELECT COUNT(*) FROM profiles WHERE deleted_at IS NULL"
            );
            const total = parseInt(countResult.rows[0].count, 10);

            const result = await db.query(
                `SELECT p.*, g.title AS goal_title, g.description AS goal_description
         FROM profiles p
         LEFT JOIN goals g ON g.id = p.goal_id AND g.deleted_at IS NULL
         WHERE p.deleted_at IS NULL
         ORDER BY p.created_at DESC
         LIMIT $1 OFFSET $2`,
                [limit, offset]
            );

            return {
                profiles: result.rows,
                pagination: {
                    page: parseInt(page, 10),
                    limit: parseInt(limit, 10),
                    total,
                    pages: Math.ceil(total / limit),
                },
            };
        } catch (error) {
            logger.error(`Error finding all profiles: ${error.message}`);
            throw error;
        }
    }
}

module.exports = ProfileService;
