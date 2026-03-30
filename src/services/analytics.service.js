const db = require("../config/database");
const logger = require("../utils/logger");

const TRUNC_UNITS = new Set(["day", "week", "month", "year"]);

/**
 * User analytics for admin dashboards.
 * User-role counts use role = 'user' (admins excluded).
 */
class AnalyticsService {
  /**
   * New user registrations over time (role = user), grouped by day/week/month/year.
   * @param {object} opts
   * @param {'day'|'week'|'month'|'year'} opts.truncUnit
   * @param {Date|null} opts.fromInclusive - null = no lower bound
   * @param {Date|null} opts.toExclusive - null = no upper bound; filter is created_at < toExclusive
   */
  static async getUserRegistrationsSeries({ truncUnit, fromInclusive, toExclusive }) {
    if (!TRUNC_UNITS.has(truncUnit)) {
      throw new Error("Invalid group/trunc unit");
    }
    try {
      const result = await db.query(
        `SELECT
           date_trunc($1::text, u.created_at) AS period_start,
           COUNT(*)::int AS count
         FROM users u
         WHERE u.role = 'user'
           AND ($2::timestamp IS NULL OR u.created_at >= $2::timestamp)
           AND ($3::timestamp IS NULL OR u.created_at < $3::timestamp)
         GROUP BY date_trunc($1::text, u.created_at)
         ORDER BY period_start ASC`,
        [truncUnit, fromInclusive, toExclusive]
      );
      return result.rows.map((row) => ({
        period_start: row.period_start,
        count: row.count,
      }));
    } catch (error) {
      logger.error(`Error fetching user registration series: ${error.message}`);
      throw error;
    }
  }

  static async getUserStats() {
    try {
      const result = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM users
            WHERE deleted_at IS NULL AND role = 'user') AS total_users,
          (SELECT COUNT(*)::int FROM users
            WHERE deleted_at IS NULL AND role = 'user' AND block_status = true) AS blocked_users,
          (SELECT COUNT(*)::int FROM users
            WHERE deleted_at IS NULL AND role = 'user' AND is_verified = true) AS verified_users,
          (SELECT COUNT(*)::int FROM users
            WHERE deleted_at IS NULL AND role = 'user'
              AND block_status = false AND is_verified = false) AS unverified_users,
          (SELECT COUNT(*)::int FROM users
            WHERE deleted_at IS NOT NULL AND role = 'user') AS deleted_users,
          (SELECT COUNT(DISTINCT t.user_id)::int
             FROM stripe_subscriptions s
             INNER JOIN stripe_transactions t ON t.id = s.transaction_id
             INNER JOIN users u ON u.id = t.user_id
                AND u.deleted_at IS NULL
                AND u.role = 'user'
             WHERE LOWER(COALESCE(TRIM(s.status), '')) IN ('active', 'trialing')
          ) AS users_with_active_subscription
      `);

      const row = result.rows[0];
      return {
        total_users: row.total_users,
        verified_users: row.verified_users,
        blocked_users: row.blocked_users,
        unverified_users: row.unverified_users,
        deleted_users: row.deleted_users,
        users_with_active_subscription: row.users_with_active_subscription,
      };
    } catch (error) {
      logger.error(`Error fetching user analytics: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AnalyticsService;
