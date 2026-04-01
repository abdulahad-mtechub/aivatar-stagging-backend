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
        const { user_id, profile_image, address, reminder, plan_key, goal_id, mentor_gender, gender, qa_list, job_type, target_weight } = profileData;

        try {
            const result = await db.query(
                `INSERT INTO profiles
           (user_id, profile_image, address, reminder, plan_key, goal_id, mentor_gender, gender, qa_list, job_type, target_weight)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
                [
                    user_id,
                    profile_image || null,
                    address || null,
                    reminder || null,
                    plan_key || null,
                    goal_id || null,
                    mentor_gender || null,
                    gender || null,
                    qa_list ? JSON.stringify(qa_list) : '[]',
                    job_type || null,
                    target_weight ?? null,
                ]
            );

            if (!result.rows[0]?.goal_id) {
                return await this.ensureProfileGoalId(result.rows[0]);
            }

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
    static async findByUserId(userId, options = {}) {
        try {
            const result = await db.query(
                `SELECT p.*, g.title AS goal_title, g.description AS goal_description, g.plan_duration AS goal_plan_duration, g.goal_weight AS goal_target_weight
         FROM profiles p
         LEFT JOIN goals g ON g.id = p.goal_id AND g.deleted_at IS NULL
         WHERE p.user_id = $1 AND p.deleted_at IS NULL`,
                [userId]
            );

            const profile = result.rows[0] || null;
            if (!profile) return null;

            if (options.ensureGoalId !== false && !profile.goal_id) {
                return await this.ensureProfileGoalId(profile);
            }

            return profile;
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
    static async findById(id, options = {}) {
        try {
            const result = await db.query(
                `SELECT p.*, g.title AS goal_title, g.description AS goal_description, g.plan_duration AS goal_plan_duration, g.goal_weight AS goal_target_weight
         FROM profiles p
         LEFT JOIN goals g ON g.id = p.goal_id AND g.deleted_at IS NULL
         WHERE p.id = $1 AND p.deleted_at IS NULL`,
                [id]
            );

            const profile = result.rows[0] || null;
            if (!profile) return null;

            if (options.ensureGoalId !== false && !profile.goal_id) {
                return await this.ensureProfileGoalId(profile);
            }

            return profile;
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
        const allowedFields = ["profile_image", "address", "reminder", "plan_key", "goal_id", "mentor_gender", "gender", "qa_list", "job_type", "target_weight"];

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
                `SELECT p.*, g.title AS goal_title, g.description AS goal_description, g.plan_duration AS goal_plan_duration, g.goal_weight AS goal_target_weight
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

    static async findGoalByFields(title, plan_duration = null, goal_weight = null) {
        const result = await db.query(
            `SELECT id, title, description, plan_duration, goal_weight
         FROM goals
         WHERE LOWER(title) = LOWER($1)
           AND COALESCE(plan_duration, '') = COALESCE($2, '')
           AND (
                ($3::float IS NULL AND goal_weight IS NULL)
                OR goal_weight = $3::float
           )
           AND deleted_at IS NULL
         LIMIT 1`,
            [title, plan_duration, goal_weight]
        );
        return result.rows[0] || null;
    }

    static async createGoal(title, description = null, plan_duration = null, goal_weight = null) {
        const result = await db.query(
            `INSERT INTO goals (title, description, plan_duration, goal_weight)
         VALUES ($1, $2, $3, $4)
         RETURNING id, title, description, plan_duration, goal_weight`,
            [title, description, plan_duration, goal_weight]
        );
        return result.rows[0];
    }

    static async ensureProfileGoalId(profile) {
        if (!profile || profile.goal_id) return profile;

        const fallbackTitle = "General Goal";
        const duration = profile.plan_key ? String(profile.plan_key).trim() : null;
        const parsedWeight =
            profile.target_weight === undefined || profile.target_weight === null || profile.target_weight === ""
                ? null
                : Number(profile.target_weight);
        const safeWeight = Number.isFinite(parsedWeight) ? parsedWeight : null;

        let goal = await this.findGoalByFields(fallbackTitle, duration, safeWeight);
        if (!goal) {
            goal = await this.createGoal(fallbackTitle, null, duration, safeWeight);
        }

        await db.query(
            `UPDATE profiles
         SET goal_id = $1, updated_at = NOW()
         WHERE id = $2 AND goal_id IS NULL`,
            [goal.id, profile.id]
        );

        return await this.findById(profile.id, { ensureGoalId: false });
    }

    static async upsertGoalSettings(userId, payload = {}) {
        const { goal_type, plan_duration, goal_weight } = payload;

        const goalTitle = String(goal_type || "").trim();
        if (!goalTitle) {
            throw new Error("goal_type is required");
        }

        const normalizedDuration = plan_duration ? String(plan_duration).trim() : null;
        const normalizedWeight =
            goal_weight === undefined || goal_weight === null || goal_weight === ""
                ? null
                : Number(goal_weight);
        const safeWeight = Number.isFinite(normalizedWeight) ? normalizedWeight : null;

        let goal = await this.findGoalByFields(goalTitle, normalizedDuration, safeWeight);
        if (!goal) {
            goal = await this.createGoal(goalTitle, null, normalizedDuration, safeWeight);
        }

        const profileRes = await db.query(
            "SELECT id FROM profiles WHERE user_id = $1 AND deleted_at IS NULL LIMIT 1",
            [userId]
        );

        if (profileRes.rows[0]) {
            await db.query(
                `UPDATE profiles
           SET goal_id = $1, plan_key = $2, target_weight = $3, updated_at = NOW()
           WHERE id = $4`,
                [goal.id, normalizedDuration, safeWeight, profileRes.rows[0].id]
            );
        } else {
            await db.query(
                `INSERT INTO profiles (user_id, goal_id, plan_key, target_weight)
           VALUES ($1, $2, $3, $4)`,
                [userId, goal.id, normalizedDuration, safeWeight]
            );
        }

        return await this.findByUserId(userId);
    }

    /**
     * Profile completion percentage for frontend onboarding.
     * Computed from the presence of key fields in `profiles`.
     *
     * @param {object|null} profile
     * @returns {number} 0..100
     */
    static calculateProfileCompletionPercentage(profile) {
        if (!profile) return 0;

        let qaList = profile.qa_list;
        if (typeof qaList === "string") {
            try {
                qaList = JSON.parse(qaList);
            } catch (_) {
                qaList = [];
            }
        }

        const completedChecks = [
            // Basic identity / picture
            typeof profile.profile_image === "string" && profile.profile_image.trim().length > 0,
            typeof profile.reminder === "string" && profile.reminder.trim().length > 0,
            typeof profile.plan_key === "string" && profile.plan_key.trim().length > 0,
            profile.goal_id !== null && profile.goal_id !== undefined && Number(profile.goal_id) > 0,
            typeof profile.mentor_gender === "string" && profile.mentor_gender.trim().length > 0,
            typeof profile.gender === "string" && profile.gender.trim().length > 0,
            typeof profile.job_type === "string" && profile.job_type.trim().length > 0,
            Array.isArray(qaList) && qaList.length > 0,

            // Nutrition targets
            profile.target_weight !== null &&
                profile.target_weight !== undefined &&
                Number.isFinite(Number(profile.target_weight)) &&
                Number(profile.target_weight) > 0,
            profile.target_calories !== null &&
                profile.target_calories !== undefined &&
                Number.isFinite(Number(profile.target_calories)) &&
                Number(profile.target_calories) > 0,
            profile.target_protein !== null &&
                profile.target_protein !== undefined &&
                Number.isFinite(Number(profile.target_protein)) &&
                Number(profile.target_protein) > 0,
            profile.target_carbs !== null &&
                profile.target_carbs !== undefined &&
                Number.isFinite(Number(profile.target_carbs)) &&
                Number(profile.target_carbs) > 0,
            profile.target_fats !== null &&
                profile.target_fats !== undefined &&
                Number.isFinite(Number(profile.target_fats)) &&
                Number(profile.target_fats) > 0,
        ];

        const total = completedChecks.length;
        const completed = completedChecks.filter(Boolean).length;

        return Math.round((completed / total) * 100);
    }
}

module.exports = ProfileService;
