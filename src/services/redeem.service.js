const db = require("../config/database");
const logger = require("../utils/logger");
const crypto = require("crypto");

/**
 * RedeemService - handles coin redemption operations
 */
class RedeemService {
  /**
   * Generate unique redeem code like RC-A1B2C3
   */
  static generateRedeemCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "RC-";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Redeem coins for a user
   */
  static async redeemCoins(userId, ruleId) {
    try {
      // 1. Get rule
      const ruleRes = await db.query(
        "SELECT * FROM reward_management WHERE id = $1 AND is_active = true",
        [ruleId]
      );
      const rule = ruleRes.rows[0];
      if (!rule) throw new Error("Reward rule not found or inactive");

      // 2. Check user has enough balance
      const balanceRes = await db.query(
        `SELECT COALESCE(SUM(CASE WHEN type = 'earned' THEN points_amount ELSE -points_amount END), 0) AS current_balance
         FROM points_transaction WHERE user_id = $1`,
        [userId]
      );
      const balance = parseInt(balanceRes.rows[0].current_balance, 10);
      if (balance < rule.points_amount) {
        throw new Error(`Insufficient balance. You need ${rule.points_amount} coins but have ${balance}`);
      }

      // 3. Generate unique redeem code
      let redeemCode;
      let isUnique = false;
      while (!isUnique) {
        redeemCode = this.generateRedeemCode();
        const existing = await db.query("SELECT id FROM redeem_coin_history WHERE redeem_code = $1", [redeemCode]);
        if (existing.rows.length === 0) isUnique = true;
      }

      // 4. Insert redemption log
      const redeemed = await db.query(
        `INSERT INTO redeem_coin_history (user_id, rule_id, module_type, redeem_code) VALUES ($1, $2, $3, $4) RETURNING *`,
        [userId, ruleId, rule.module_type, redeemCode]
      );

      // 5. Insert to consolidated transaction log
      await db.query(
        `INSERT INTO points_transaction (type, user_id, rule_id, points_amount, module_type) VALUES ('redeemed', $1, $2, $3, $4)`,
        [userId, ruleId, rule.points_amount, rule.module_type]
      );

      return { redemption: redeemed.rows[0], points_spent: rule.points_amount };
    } catch (error) {
      logger.error(`Error redeeming coins: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user's redemption history
   */
  static async getUserRedeemHistory(userId, options = {}) {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;
    try {
      const countRes = await db.query(
        "SELECT COUNT(*) FROM redeem_coin_history WHERE user_id = $1",
        [userId]
      );
      const result = await db.query(
        `SELECT rch.*, rm.name AS rule_name, rm.points_amount
         FROM redeem_coin_history rch
         JOIN reward_management rm ON rch.rule_id = rm.id
         WHERE rch.user_id = $1
         ORDER BY rch.created_at DESC LIMIT $2 OFFSET $3`,
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
      logger.error(`Error getting redeem history: ${error.message}`);
      throw error;
    }
  }
}

module.exports = RedeemService;
