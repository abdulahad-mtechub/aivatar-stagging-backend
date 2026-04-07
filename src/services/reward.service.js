const db = require("../config/database");
const logger = require("../utils/logger");
const AppError = require("../utils/appError");
const { validatePaginationParams, generatePagination } = require("../utils/pagination");
const { parseBoolean, normalizeSearchTerm } = require("../utils/partialSearch");

function isUniqueViolation(error) {
  return error && error.code === "23505";
}

function normalizeRuleName(name) {
  return String(name ?? "").trim().toLowerCase();
}

/**
 * RewardService - handles reward rules and points earning
 */
class RewardService {
  // ─── Admin: Reward Rule Management ───────────────────────────────────────

  static async getAllRules(options = {}) {
      const { page = 1, limit = 10, q, sort_by = "created_at", sort_order = "desc" } = options;
      const reward_type = options.reward_type || options.rewardtype;
      const { page: pageNum, limit: limitNum, offset } = validatePaginationParams(page, limit);
      const searchTerm = normalizeSearchTerm(q);
      const safeSortMap = {
        id: "id",
        name: "name",
        module_type: "module_type",
        trigger_event: "trigger_event",
        reward_type: "reward_type",
        points_amount: "points_amount",
        price: "price",
        currency: "currency",
        is_active: "is_active",
        created_at: "created_at",
        updated_at: "updated_at",
      };
      const requestedSort = String(sort_by || "").toLowerCase();
      const effectiveSort = safeSortMap[requestedSort] || "created_at";
      const sortDir = String(sort_order || "").toLowerCase() === "asc" ? "ASC" : "DESC";
      try {
        let query = "SELECT * FROM reward_management";
        let countQuery = "SELECT COUNT(*) FROM reward_management";
        const params = [];
        const where = [];

        if (reward_type) {
          params.push(reward_type);
          where.push(`reward_type = $${params.length}`);
        }
        if (searchTerm) {
          params.push(`%${searchTerm}%`);
          where.push(
            `(name ILIKE $${params.length} OR module_type ILIKE $${params.length} OR trigger_event ILIKE $${params.length} OR reward_type ILIKE $${params.length} OR currency ILIKE $${params.length})`
          );
        }

        if (where.length > 0) {
          query += ` WHERE ${where.join(" AND ")}`;
          countQuery += ` WHERE ${where.join(" AND ")}`;
        }

      const countParams = [...params];
      query += ` ORDER BY ${effectiveSort} ${sortDir}, id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limitNum, offset);

      const countRes = await db.query(countQuery, countParams);
      const result = await db.query(query, params);
      const total = parseInt(countRes.rows[0].count, 10);

      return {
        rules: result.rows,
        pagination: {
          ...generatePagination(pageNum, limitNum, total),
          sort_by: Object.keys(safeSortMap).find((k) => safeSortMap[k] === effectiveSort) || "created_at",
          sort_order: sortDir.toLowerCase(),
        },
      };
    } catch (error) {
      logger.error(`Error getting reward rules: ${error.message}`);
      throw error;
    }
  }

  static async getRuleById(id) {
    try {
      const result = await db.query("SELECT * FROM reward_management WHERE id = $1", [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error getting reward rule: ${error.message}`);
      throw error;
    }
  }

  static async createRule(data) {
    const {
      name, description, module_type, trigger_event,
      reward_type, points_amount,
      frequency_limit, events_per_day = 1, is_active = true,
      price, currency
    } = data;
    const key = normalizeRuleName(name);
    if (!key) {
      throw new AppError("Rule name is required", 400);
    }
    try {
      const dup = await db.query(
        `SELECT id FROM reward_management WHERE LOWER(TRIM(name)) = $1 LIMIT 1`,
        [key]
      );
      if (dup.rows.length > 0) {
        throw new AppError(`A reward rule named "${name}" already exists`, 400);
      }
      const result = await db.query(
        `INSERT INTO reward_management 
          (name, description, module_type, trigger_event, reward_type, points_amount, frequency_limit, events_per_day, is_active, price, currency)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [name, description, module_type, trigger_event, reward_type, points_amount, frequency_limit, events_per_day, is_active, price, currency]
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error creating reward rule: ${error.message}`);
      if (isUniqueViolation(error)) {
        throw new AppError(`A reward rule named "${name}" already exists`, 400);
      }
      throw error;
    }
  }

  static async updateRule(id, data) {
    const { name, description, module_type, trigger_event, reward_type, points_amount, frequency_limit, events_per_day, is_active, price, currency } = data;
    try {
      if (name !== undefined && name !== null) {
        const key = normalizeRuleName(name);
        if (!key) {
          throw new AppError("Rule name cannot be empty", 400);
        }
        const dup = await db.query(
          `SELECT id FROM reward_management WHERE LOWER(TRIM(name)) = $1 AND id != $2 LIMIT 1`,
          [key, id]
        );
        if (dup.rows.length > 0) {
          throw new AppError(`A reward rule named "${name}" already exists`, 400);
        }
      }
      const result = await db.query(
        `UPDATE reward_management SET
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          module_type = COALESCE($3, module_type),
          trigger_event = COALESCE($4, trigger_event),
          reward_type = COALESCE($5, reward_type),
          points_amount = COALESCE($6, points_amount),
          frequency_limit = COALESCE($7, frequency_limit),
          events_per_day = COALESCE($8, events_per_day),
          is_active = COALESCE($9, is_active),
          price = COALESCE($10, price),
          currency = COALESCE($11, currency),
          updated_at = NOW()
        WHERE id = $12 RETURNING *`,
        [name, description, module_type, trigger_event, reward_type, points_amount, frequency_limit, events_per_day, is_active, price, currency, id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error updating reward rule: ${error.message}`);
      if (isUniqueViolation(error)) {
        throw new AppError(
          name !== undefined && name !== null
            ? `A reward rule named "${name}" already exists`
            : "Reward rule name must be unique",
          400
        );
      }
      throw error;
    }
  }

  static async deleteRule(id) {
    try {
      const result = await db.query("DELETE FROM reward_management WHERE id = $1 RETURNING *", [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error deleting reward rule: ${error.message}`);
      throw error;
    }
  }

  // ─── User: Earn Points ────────────────────────────────────────────────────

  static async earnPoints(userId, ruleId) {
    try {
      // 1. Get rule
      const ruleRes = await db.query("SELECT * FROM reward_management WHERE id = $1 AND is_active = true", [ruleId]);
      const rule = ruleRes.rows[0];
      if (!rule) throw new Error("Reward rule not found or inactive");

      // 2. Check daily limit
      if (rule.events_per_day > 0) {
        const todayCount = await db.query(
          `SELECT COUNT(*) FROM user_earned_reward_points 
           WHERE user_id = $1 AND rule_id = $2 
           AND point_earned_date >= CURRENT_DATE`,
          [userId, ruleId]
        );
        if (parseInt(todayCount.rows[0].count, 10) >= rule.events_per_day) {
          throw new Error(`Daily limit reached for this reward rule (max ${rule.events_per_day}/day)`);
        }
      }

      // 3. Insert earnings log
      const earned = await db.query(
        `INSERT INTO user_earned_reward_points (user_id, rule_id, module_type) VALUES ($1, $2, $3) RETURNING *`,
        [userId, ruleId, rule.module_type]
      );

      // 4. Insert to consolidated transaction log
      await db.query(
        `INSERT INTO points_transaction (type, user_id, rule_id, points_amount, module_type) VALUES ('earned', $1, $2, $3, $4)`,
        [userId, ruleId, rule.points_amount, rule.module_type]
      );

      return { earned: earned.rows[0], points: rule.points_amount };
    } catch (error) {
      logger.error(`Error earning points: ${error.message}`);
      throw error;
    }
  }

  // ─── User: Get Balance ────────────────────────────────────────────────────

  static async getUserBalance(userId) {
    try {
      const result = await db.query(
        `SELECT 
          COALESCE(SUM(CASE WHEN type = 'earned' THEN points_amount ELSE 0 END), 0) AS total_earned,
          COALESCE(SUM(CASE WHEN type = 'redeemed' THEN points_amount ELSE 0 END), 0) AS total_redeemed,
          COALESCE(SUM(CASE WHEN type = 'earned' THEN points_amount ELSE -points_amount END), 0) AS current_balance
         FROM points_transaction WHERE user_id = $1`,
        [userId]
      );
      return {
        total_earned: parseInt(result.rows[0].total_earned, 10),
        total_redeemed: parseInt(result.rows[0].total_redeemed, 10),
        current_balance: parseInt(result.rows[0].current_balance, 10)
      };
    } catch (error) {
      logger.error(`Error getting user balance: ${error.message}`);
      throw error;
    }
  }

  // ─── User: Earning History ────────────────────────────────────────────────

  static async getUserEarningHistory(userId, options = {}) {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;
    try {
      const countRes = await db.query(
        "SELECT COUNT(*) FROM user_earned_reward_points WHERE user_id = $1",
        [userId]
      );
      const result = await db.query(
        `SELECT ue.*, rm.name AS rule_name, rm.points_amount, rm.trigger_event
         FROM user_earned_reward_points ue
         JOIN reward_management rm ON ue.rule_id = rm.id
         WHERE ue.user_id = $1
         ORDER BY ue.created_at DESC LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
      return {
        history: result.rows,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total: parseInt(countRes.rows[0].count, 10),
          pages: Math.ceil(countRes.rows[0].count / limit),
        },
      };
    } catch (error) {
      logger.error(`Error getting earning history: ${error.message}`);
      throw error;
    }
  }

  static async getLeaderboard(options = {}) {
    const {
      page = 1,
      limit = 10,
      q,
      sort_by = "totalCoins",
      sort_order = "desc",
      not_pagination,
    } = options;

    const disablePagination = parseBoolean(not_pagination, false);
    const { page: pageNum, limit: limitNum, offset } = validatePaginationParams(page, limit);
    const searchTerm = normalizeSearchTerm(q);

    const safeSortMap = {
      totalcoins: "total_coins",
      rank: "rank",
      name: "name",
      email: "email",
      created_at: "created_at",
    };
    const requestedSort = String(sort_by || "").toLowerCase();
    const effectiveSort = safeSortMap[requestedSort] || "total_coins";
    const sortDir = String(sort_order || "").toLowerCase() === "asc" ? "ASC" : "DESC";

    try {
      const params = [];
      const whereParts = [];
      if (searchTerm) {
        params.push(`%${searchTerm}%`);
        whereParts.push(
          `(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR COALESCE(b.title, '') ILIKE $${params.length})`
        );
      }
      const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

      const query = `
        WITH balances AS (
          SELECT
            u.id AS user_id,
            COALESCE(
              SUM(
                CASE
                  WHEN pt.type = 'earned' THEN pt.points_amount
                  ELSE -pt.points_amount
                END
              ),
              0
            )::int AS total_coins
          FROM users u
          LEFT JOIN points_transaction pt ON pt.user_id = u.id
          WHERE u.deleted_at IS NULL AND u.role = 'user'
          GROUP BY u.id
        ),
        ranked AS (
          SELECT
            u.id,
            u.name,
            u.email,
            p.profile_image AS avatar,
            u.created_at,
            bal.total_coins,
            ROW_NUMBER() OVER (ORDER BY bal.total_coins DESC, u.id ASC)::int AS rank,
            json_build_object(
              'id', b.id,
              'title', b.title,
              'max_points', b.max_points,
              'badge_image', b.badge_image,
              'color', b.color,
              'color_value', b.color_value,
              'created_at', b.created_at,
              'updated_at', b.updated_at
            ) AS current_badge
          FROM users u
          JOIN balances bal ON bal.user_id = u.id
          LEFT JOIN profiles p ON p.user_id = u.id AND p.deleted_at IS NULL
          LEFT JOIN LATERAL (
            SELECT b1.*
            FROM badges b1
            WHERE b1.max_points <= bal.total_coins
            ORDER BY b1.max_points DESC, b1.id DESC
            LIMIT 1
          ) b ON TRUE
          ${whereSql}
        )
        SELECT *
        FROM ranked
      `;

      const result = await db.query(query, params);
      const rows = result.rows || [];

      const topByRank = [...rows]
        .filter((r) => r.rank <= 3)
        .sort((a, b) => a.rank - b.rank);

      const mapUser = (r) => ({
        name: r.name,
        email: r.email,
        rank: r.rank,
        avatar: r.avatar,
        currentBadge: r.current_badge && r.current_badge.id ? r.current_badge : null,
        totalCoins: r.total_coins,
      });

      const topUsers = {
        first: topByRank[0] ? mapUser(topByRank[0]) : null,
        second: topByRank[1] ? mapUser(topByRank[1]) : null,
        third: topByRank[2] ? mapUser(topByRank[2]) : null,
      };

      const comparator = (a, b) => {
        const dir = sortDir === "ASC" ? 1 : -1;
        if (effectiveSort === "name") {
          return dir * String(a.name || "").localeCompare(String(b.name || ""));
        }
        if (effectiveSort === "email") {
          return dir * String(a.email || "").localeCompare(String(b.email || ""));
        }
        if (effectiveSort === "created_at") {
          return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        }
        return dir * ((a[effectiveSort] || 0) - (b[effectiveSort] || 0));
      };

      const otherRows = rows
        .filter((r) => r.rank > 3)
        .sort(comparator);

      const pagedOtherRows = disablePagination
        ? otherRows
        : otherRows.slice(offset, offset + limitNum);

      return {
        topUsers,
        otherUsers: pagedOtherRows.map(mapUser),
        ...(disablePagination
          ? {}
          : {
              pagination: {
                ...generatePagination(pageNum, limitNum, otherRows.length),
                sort_by: Object.keys(safeSortMap).find((k) => safeSortMap[k] === effectiveSort) || "totalcoins",
                sort_order: sortDir.toLowerCase(),
              },
            }),
      };
    } catch (error) {
      logger.error(`Error getting leaderboard: ${error.message}`);
      throw error;
    }
  }
}

module.exports = RewardService;
