const db = require("../config/database");
const logger = require("../utils/logger");
const { validatePaginationParams, generatePagination } = require("../utils/pagination");
const { parseBoolean, buildPartialSearchClause } = require("../utils/partialSearch");

/**
 * User Service - handles user-related database operations
 */
class UserService {
  static MILESTONE_STEP_KG = 5;

  static sanitizeUser(user = {}) {
    const { password, confirm_password, otp, otp_expires_at, ...safe } = user;
    return safe;
  }

  static mapUserProfileRows(rows = []) {
    return rows.map((r) => {
      const {
        p_id,
        p_user_id,
        p_profile_image,
        p_address,
        p_reminder,
        p_plan_key,
        p_goal_id,
        p_mentor_gender,
        p_gender,
        p_qa_list,
        p_job_type,
        p_target_calories,
        p_target_protein,
        p_target_carbs,
        p_target_fats,
        p_target_weight,
        p_created_at,
        p_updated_at,
        p_deleted_at,
        ...user
      } = r;

      const safeUser = this.sanitizeUser(user);
      const hasProfile = p_id !== null && p_id !== undefined;
      return {
        ...safeUser,
        profile: hasProfile
          ? {
              id: p_id,
              user_id: p_user_id,
              profile_image: p_profile_image,
              address: p_address,
              reminder: p_reminder,
              plan_key: p_plan_key,
              goal_id: p_goal_id,
              mentor_gender: p_mentor_gender,
              gender: p_gender,
              qa_list: p_qa_list,
              job_type: p_job_type,
              target_calories: p_target_calories,
              target_protein: p_target_protein,
              target_carbs: p_target_carbs,
              target_fats: p_target_fats,
              target_weight: p_target_weight,
              created_at: p_created_at,
              updated_at: p_updated_at,
              deleted_at: p_deleted_at,
            }
          : null,
      };
    });
  }

  /**
   * Whitelist ORDER BY for /users/with-profile (SQL injection safe).
   * sort_by: created_at | updated_at | id | name | email | block_status | is_verified | profile_created_at | plan_key
   */
  static buildWithProfileSort(options = {}) {
    const rawKey = String(options.sort_by ?? options.sortBy ?? "created_at")
      .trim()
      .toLowerCase();
    const rawOrder = String(options.sort_order ?? options.sortOrder ?? "desc")
      .trim()
      .toLowerCase();

    const columnMap = {
      created_at: "u.created_at",
      updated_at: "u.updated_at",
      id: "u.id",
      name: "u.name",
      email: "u.email",
      block_status: "u.block_status",
      is_verified: "u.is_verified",
      profile_created_at: "p.created_at",
      plan_key: "p.plan_key",
    };

    const orderSql = rawOrder === "asc" ? "ASC" : "DESC";
    const colSql = columnMap[rawKey] || columnMap.created_at;
    const effectiveKey = columnMap[rawKey] ? rawKey : "created_at";

    return {
      orderByClause: `${colSql} ${orderSql}, u.id DESC`,
      sort_by: effectiveKey,
      sort_order: orderSql === "ASC" ? "asc" : "desc",
    };
  }

  static async getUsersWithProfiles(whereSql, whereParams, options = {}) {
    const { page = 1, limit = 10, q, not_pagination } = options;
    const disablePagination = parseBoolean(not_pagination, false);
    const { page: pageNum, limit: limitNum, offset } = validatePaginationParams(page, limit);

    const { orderByClause, sort_by, sort_order } = this.buildWithProfileSort(options);
    const paramsBase = [...whereParams];
    const whereParts = [whereSql];
    const search = buildPartialSearchClause(
      ["u.name", "u.email", "p.plan_key"],
      q,
      paramsBase.length + 1
    );
    if (search.clause) {
      whereParts.push(search.clause);
      paramsBase.push(...search.params);
    }
    const finalWhereSql = whereParts.join(" AND ");

    const countRes = await db.query(
      `SELECT COUNT(*) AS count
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id AND p.deleted_at IS NULL
       WHERE ${finalWhereSql}`,
      paramsBase
    );
    const total = parseInt(countRes.rows[0]?.count || "0", 10);

    const params = [...paramsBase];
    let paginationSql = "";
    if (!disablePagination) {
      params.push(limitNum, offset);
      paginationSql = `LIMIT $${params.length - 1} OFFSET $${params.length}`;
    }
    const rows = await db.query(
      `SELECT
         u.*,
         p.id AS p_id,
         p.user_id AS p_user_id,
         p.profile_image AS p_profile_image,
         p.address AS p_address,
         p.reminder AS p_reminder,
         p.plan_key AS p_plan_key,
         p.goal_id AS p_goal_id,
         p.mentor_gender AS p_mentor_gender,
         p.gender AS p_gender,
         p.qa_list AS p_qa_list,
         p.job_type AS p_job_type,
         p.target_calories AS p_target_calories,
         p.target_protein AS p_target_protein,
         p.target_carbs AS p_target_carbs,
         p.target_fats AS p_target_fats,
         p.target_weight AS p_target_weight,
         p.created_at AS p_created_at,
         p.updated_at AS p_updated_at,
         p.deleted_at AS p_deleted_at
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id AND p.deleted_at IS NULL
       WHERE ${finalWhereSql}
       ORDER BY ${orderByClause}
       ${paginationSql}`,
      params
    );

    return {
      users: this.mapUserProfileRows(rows.rows),
      ...(disablePagination
        ? {}
        : {
            pagination: {
              ...generatePagination(pageNum, limitNum, total),
              sort_by,
              sort_order,
            },
          }),
    };
  }

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
   * Find any user by email (including soft-deleted)
   * @param {string} email - User's email address
   * @returns {Promise<object|null>} User object or null if not found
   */
  static async findAnyByEmail(email) {
    try {
      const result = await db.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error finding any user by email: ${error.message}`);
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

  static async findAnyById(id) {
    try {
      const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error finding any user by ID: ${error.message}`);
      throw error;
    }
  }

  static buildMeasurementDelta(current = null, previous = null) {
    const keys = ["weight", "waist", "chest", "hips", "arm"];
    const out = {};
    for (const key of keys) {
      const c = current?.[key];
      const p = previous?.[key];
      const cNum = c === null || c === undefined ? null : Number(c);
      const pNum = p === null || p === undefined ? null : Number(p);
      out[key] =
        Number.isFinite(cNum) && Number.isFinite(pNum)
          ? Number((cNum - pNum).toFixed(2))
          : null;
    }
    return out;
  }

  static buildWeightMilestones(startWeight, latestWeight) {
    const s = Number(startWeight);
    const l = Number(latestWeight);
    if (!Number.isFinite(s) || !Number.isFinite(l)) {
      return {
        start_weight: Number.isFinite(s) ? s : null,
        latest_weight: Number.isFinite(l) ? l : null,
        weight_lost_kg: null,
        milestones_reached_kg: [],
        next_milestone_kg: UserService.MILESTONE_STEP_KG,
        remaining_to_next_milestone_kg: null,
      };
    }

    const loss = Math.max(0, Number((s - l).toFixed(2)));
    const maxTier = Math.floor(loss / UserService.MILESTONE_STEP_KG) * UserService.MILESTONE_STEP_KG;
    const reached = [];
    for (let t = UserService.MILESTONE_STEP_KG; t <= maxTier; t += UserService.MILESTONE_STEP_KG) {
      reached.push(t);
    }
    const nextMilestone = maxTier + UserService.MILESTONE_STEP_KG;
    const remaining = Number((nextMilestone - loss).toFixed(2));

    return {
      start_weight: s,
      latest_weight: l,
      weight_lost_kg: loss,
      milestones_reached_kg: reached,
      next_milestone_kg: nextMilestone,
      remaining_to_next_milestone_kg: remaining,
    };
  }

  static async getAdminProgressMonitoring(userId) {
    const user = await this.findAnyById(userId);
    if (!user) return null;

    const profileRes = await db.query(
      `SELECT p.*, g.title AS goal_title, g.description AS goal_description
       FROM profiles p
       LEFT JOIN goals g ON g.id = p.goal_id AND g.deleted_at IS NULL
       WHERE p.user_id = $1 AND p.deleted_at IS NULL
       LIMIT 1`,
      [userId]
    );
    const profile = profileRes.rows[0] || null;

    const reminderRes = await db.query(
      `SELECT *
       FROM reminder_settings
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );
    const reminders = reminderRes.rows[0] || null;

    const balanceRes = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'earned' THEN points_amount ELSE 0 END), 0) AS total_earned,
         COALESCE(SUM(CASE WHEN type = 'redeemed' THEN points_amount ELSE 0 END), 0) AS total_redeemed,
         COALESCE(SUM(CASE WHEN type = 'earned' THEN points_amount ELSE -points_amount END), 0) AS current_balance
       FROM points_transaction
       WHERE user_id = $1`,
      [userId]
    );
    const balance = {
      total_earned: parseInt(balanceRes.rows[0]?.total_earned || "0", 10),
      total_redeemed: parseInt(balanceRes.rows[0]?.total_redeemed || "0", 10),
      current_balance: parseInt(balanceRes.rows[0]?.current_balance || "0", 10),
    };

    const subRes = await db.query(
      `SELECT
         s.stripe_subscription_id,
         s.plan_key,
         s.status,
         s.current_period_end,
         t.session_id,
         t.amount_total,
         t.currency,
         t.created_at AS subscribed_at
       FROM stripe_subscriptions s
       JOIN stripe_transactions t ON t.id = s.transaction_id
       WHERE t.user_id = $1
       ORDER BY s.updated_at DESC, s.created_at DESC
       LIMIT 1`,
      [userId]
    );
    const sub = subRes.rows[0] || null;

    const latestRes = await db.query(
      `SELECT * FROM user_measurements
       WHERE user_id = $1
       ORDER BY recorded_date DESC, id DESC
       LIMIT 2`,
      [userId]
    );
    const latest = latestRes.rows[0] || null;
    const previous = latestRes.rows[1] || null;

    const baselineRes = await db.query(
      `SELECT * FROM user_measurements
       WHERE user_id = $1
       ORDER BY recorded_date ASC, id ASC
       LIMIT 1`,
      [userId]
    );
    const baseline = baselineRes.rows[0] || null;

    const historyRes = await db.query(
      `SELECT *
       FROM user_measurements
       WHERE user_id = $1
       ORDER BY recorded_date DESC, id DESC
       LIMIT 30`,
      [userId]
    );
    const recent_measurements = historyRes.rows || [];

    const fromPrevious = this.buildMeasurementDelta(latest, previous);
    const fromStart = this.buildMeasurementDelta(latest, baseline);
    const milestones = this.buildWeightMilestones(baseline?.weight, latest?.weight);

    return {
      user: this.sanitizeUser(user),
      profile,
      reminders,
      balance,
      account_status: user.block_status ? "inactive" : "active",
      subscription: {
        has_subscription: !!(sub || profile?.plan_key),
        plan_key: sub?.plan_key || profile?.plan_key || null,
        status: sub?.status || (profile?.plan_key ? "unknown" : "none"),
        stripe_subscription_id: sub?.stripe_subscription_id || null,
        current_period_end: sub?.current_period_end || null,
        session_id: sub?.session_id || null,
        amount_total: sub?.amount_total || null,
        currency: sub?.currency || null,
        subscribed_at: sub?.subscribed_at || null,
      },
      weight_milestones: milestones,
      body_measurement_changes: {
        latest,
        previous,
        baseline,
        recent_measurements,
        from_previous: fromPrevious,
        from_start: fromStart,
      },
    };
  }

  /**
   * Create a new user
   * @param {object} userData - User data
   * @returns {Promise<object>} Created user object
   */
  static async create(userData) {
    const { name, email, password, confirm_password, role = "user" } = userData;

    try {
      const result = await db.query(
        "INSERT INTO users (name, email, password, confirm_password, role) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [name, email, password, confirm_password, role]
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
      "confirm_password",
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
   * Set OTP for a user (used for registration/resend)
   * @param {number} userId
   * @param {string} otp
   * @param {Date|string} expiresAt
   */
  static async setOtp(userId, otp, expiresAt) {
    try {
      const result = await db.query(
        "UPDATE users SET otp = $1, otp_expires_at = $2, updated_at = NOW() WHERE id = $3 RETURNING *",
        [otp, expiresAt, userId]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error setting OTP for user: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mark user as verified and clear OTP
   * @param {number} userId
   */
  static async verify(userId) {
    try {
      const result = await db.query(
        "UPDATE users SET is_verified = true, otp = NULL, otp_expires_at = NULL, updated_at = NOW() WHERE id = $1 RETURNING *",
        [userId]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error verifying user: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a user's password
   * @param {number} id
   * @param {string} hashedPassword
   */
  static async updatePassword(id, hashedPassword) {
    try {
      const result = await db.query(
        "UPDATE users SET password = $1, otp = NULL, otp_expires_at = NULL, updated_at = NOW() WHERE id = $2 RETURNING *",
        [hashedPassword, id]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error updating user password: ${error.message}`);
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
      // PERMANENTLY DELETE EXPIRED ACCOUNTS (> 90 days)
      await db.query(
        "DELETE FROM users WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '90 days'"
      );

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

  static async findAllWithProfiles(options = {}) {
    // Non-deleted users (mixed active/inactive by default), role=user only.
    const { status } = options;
    const normalized = status ? String(status).toLowerCase() : "mixed";

    if (normalized === "mixed") {
      return await this.getUsersWithProfiles(
        "u.deleted_at IS NULL AND u.role = $1",
        ["user"],
        options
      );
    }

    if (normalized !== "active" && normalized !== "inactive") {
      throw new Error("status must be active, inactive, or mixed");
    }

    const isBlocked = normalized === "inactive";
    return await this.getUsersWithProfiles(
      "u.deleted_at IS NULL AND u.role = $1 AND u.block_status = $2",
      ["user", isBlocked],
      options
    );
  }

  static async findDeletedWithProfiles(options = {}) {
    return await this.getUsersWithProfiles(
      "u.deleted_at IS NOT NULL AND u.role = $1",
      ["user"],
      options
    );
  }

}

module.exports = UserService;

