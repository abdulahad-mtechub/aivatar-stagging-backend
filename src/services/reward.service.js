const db = require("../config/database");
const logger = require("../utils/logger");

/**
 * RewardService - handles reward rules and points earning
 */
class RewardService {
  // ─── Admin: Reward Rule Management ───────────────────────────────────────

  static async getAllRules(options = {}) {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;
    try {
      const countRes = await db.query("SELECT COUNT(*) FROM reward_management");
      const result = await db.query(
        "SELECT * FROM reward_management ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        [limit, offset]
      );
      return {
        rules: result.rows,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total: parseInt(countRes.rows[0].count, 10),
          pages: Math.ceil(countRes.rows[0].count / limit),
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
      reward_type, type = "generic", points_amount,
      frequency_limit, events_per_day = 1, is_active = true
    } = data;
    try {
      const result = await db.query(
        `INSERT INTO reward_management 
          (name, description, module_type, trigger_event, reward_type, type, points_amount, frequency_limit, events_per_day, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [name, description, module_type, trigger_event, reward_type, type, points_amount, frequency_limit, events_per_day, is_active]
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error creating reward rule: ${error.message}`);
      throw error;
    }
  }

  static async updateRule(id, data) {
    const { name, description, module_type, trigger_event, reward_type, type, points_amount, frequency_limit, events_per_day, is_active } = data;
    try {
      const result = await db.query(
        `UPDATE reward_management SET
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          module_type = COALESCE($3, module_type),
          trigger_event = COALESCE($4, trigger_event),
          reward_type = COALESCE($5, reward_type),
          type = COALESCE($6, type),
          points_amount = COALESCE($7, points_amount),
          frequency_limit = COALESCE($8, frequency_limit),
          events_per_day = COALESCE($9, events_per_day),
          is_active = COALESCE($10, is_active),
          updated_at = NOW()
        WHERE id = $11 RETURNING *`,
        [name, description, module_type, trigger_event, reward_type, type, points_amount, frequency_limit, events_per_day, is_active, id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error updating reward rule: ${error.message}`);
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
}

module.exports = RewardService;
