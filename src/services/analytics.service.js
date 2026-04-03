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

  static async getAdminKPIs() {
    try {
      const now = new Date();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const query = `
        WITH current_stats AS (
          SELECT
            (SELECT COUNT(*)::float FROM users WHERE role = 'user' AND deleted_at IS NULL) AS total_users,
            (SELECT COUNT(*)::float FROM users WHERE role = 'user' AND deleted_at IS NULL AND is_verified = true) AS active_users,
            (SELECT COUNT(DISTINCT t.user_id)::float 
               FROM stripe_subscriptions s 
               JOIN stripe_transactions t ON s.transaction_id = t.id 
               WHERE s.status IN ('active', 'trialing')) AS paid_users,
            (SELECT COALESCE(SUM(amount_total), 0)::float / 100.0 FROM stripe_transactions WHERE status = 'succeeded') AS total_revenue,
            (SELECT COALESCE(SUM(amount_total), 0)::float / 100.0 FROM stripe_transactions t
               JOIN stripe_subscriptions s ON s.transaction_id = t.id
               WHERE s.status IN ('active', 'trialing') AND s.created_at >= $1) AS monthly_recurring_revenue,
            (SELECT COUNT(*)::float FROM stripe_subscriptions WHERE status = 'canceled' AND updated_at >= $1) AS churn_count,
            (SELECT COUNT(*)::float FROM stripe_subscriptions WHERE status IN ('active', 'trialing')) AS active_subs_count
        ),
        prev_stats AS (
          SELECT
            (SELECT COUNT(*)::float FROM users WHERE role = 'user' AND created_at < $1 AND deleted_at IS NULL) AS total_users,
            (SELECT COUNT(*)::float FROM users WHERE role = 'user' AND created_at < $1 AND deleted_at IS NULL AND is_verified = true) AS active_users,
            (SELECT COUNT(DISTINCT t.user_id)::float 
               FROM stripe_subscriptions s 
               JOIN stripe_transactions t ON s.transaction_id = t.id 
               WHERE s.status IN ('active', 'trialing') AND s.created_at < $1) AS paid_users,
            (SELECT COALESCE(SUM(amount_total), 0)::float / 100.0 FROM stripe_transactions WHERE status = 'succeeded' AND created_at < $1) AS total_revenue,
            (SELECT COALESCE(SUM(amount_total), 0)::float / 100.0 FROM stripe_transactions t
               JOIN stripe_subscriptions s ON s.transaction_id = t.id
               WHERE s.status IN ('active', 'trialing') AND s.created_at >= $2 AND s.created_at < $1) AS monthly_recurring_revenue,
            (SELECT COUNT(*)::float FROM stripe_subscriptions WHERE status = 'canceled' AND updated_at >= $2 AND updated_at < $1) AS churn_count,
            (SELECT COUNT(*)::float FROM stripe_subscriptions WHERE (status IN ('active', 'trialing') OR (status = 'canceled' AND updated_at >= $1)) AND created_at < $1) AS active_subs_count_at_start
        )
        SELECT 
          c.*,
          p.total_users AS prev_total_users,
          p.active_users AS prev_active_users,
          p.paid_users AS prev_paid_users,
          p.total_revenue AS prev_total_revenue,
          p.monthly_recurring_revenue AS prev_mrr,
          p.churn_count AS prev_churn_count,
          p.active_subs_count_at_start
        FROM current_stats c, prev_stats p;
      `;

      const res = await db.query(query, [monthAgo, twoMonthsAgo]);
      const row = res.rows[0];

      const calcTrend = (curr, prev) => {
        if (!prev || prev === 0) return { percentage: 0, direction: "up" };
        const percentage = ((curr - prev) / prev) * 100;
        return {
          percentage: parseFloat(percentage.toFixed(2)),
          direction: percentage >= 0 ? "up" : "down"
        };
      };

      const churnRate = row.active_subs_count_at_start > 0 
        ? (row.churn_count / row.active_subs_count_at_start) * 100 
        : 0;
      const prevChurnRate = (row.active_subs_count_at_start + row.prev_churn_count) > 0
        ? (row.prev_churn_count / (row.active_subs_count_at_start + row.prev_churn_count)) * 100
        : 0;

      return {
        kpis: {
          totalUsers: {
            value: parseInt(row.total_users),
            ...calcTrend(row.total_users, row.prev_total_users)
          },
          activeUsers: {
            value: parseInt(row.active_users),
            ...calcTrend(row.active_users, row.prev_active_users)
          },
          paidUsers: {
            value: parseInt(row.paid_users),
            ...calcTrend(row.paid_users, row.prev_paid_users)
          },
          totalRevenue: {
            value: parseFloat(row.total_revenue.toFixed(2)),
            ...calcTrend(row.total_revenue, row.prev_total_revenue)
          },
          monthlyRecurringRevenue: {
            value: parseFloat(row.monthly_recurring_revenue.toFixed(2)),
            ...calcTrend(row.monthly_recurring_revenue, row.prev_mrr)
          },
          churnRate: {
            value: parseFloat(churnRate.toFixed(2)),
            percentage: parseFloat((churnRate - prevChurnRate).toFixed(2)),
            direction: churnRate <= prevChurnRate ? "down" : "up"
          }
        }
      };
    } catch (error) {
      logger.error(`Error fetching admin KPIs: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AnalyticsService;
