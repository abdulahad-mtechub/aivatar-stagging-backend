const { pool } = require("../config/database");
const logger = require("../utils/logger");

// Milestone days that trigger celebrations
const MILESTONES = [3, 7, 14, 30, 60, 90, 180, 365];

/**
 * Service for managing user streaks
 */
class StreakService {

  /**
   * Record activity for today.
   * Prevents duplicate entries on the same calendar day.
   * @param {number} userId
   * @param {string} activityType - e.g. 'workout', 'meal', 'general'
   * @param {number} [ruleId] - Optional associated reward management rule ID
   */
  static async createStreak(userId, activityType = "general", ruleId = null) {
    // 1. Guard: check if already recorded today
    const todayCheckQuery = ruleId
      ? `SELECT id FROM user_streaks WHERE user_id = $1 AND rule_id = $2 AND DATE(steak_added_date AT TIME ZONE 'UTC') = CURRENT_DATE AND is_streak = 1`
      : `SELECT id FROM user_streaks WHERE user_id = $1 AND activity_type = $2 AND DATE(steak_added_date AT TIME ZONE 'UTC') = CURRENT_DATE AND is_streak = 1`;

    const todayCheckParams = ruleId ? [userId, ruleId] : [userId, activityType];
    const todayCheck = await pool.query(todayCheckQuery, todayCheckParams);

    if (todayCheck.rows.length > 0) {
      throw new Error(`Streak already recorded today for this activity/rule`);
    }

    // 2. Fetch Rule Details (if ruleId provided)
    let rulePoints = 0;
    let cycleCap = null;
    if (ruleId) {
      const ruleRes = await pool.query(`SELECT * FROM reward_management WHERE id = $1`, [ruleId]);
      if (ruleRes.rows.length > 0) {
        const rule = ruleRes.rows[0];
        rulePoints = rule.points_amount;
        if (rule.frequency_limit) {
          if (rule.frequency_limit.toLowerCase() === 'weekly') cycleCap = 7;
          else if (rule.frequency_limit.toLowerCase() === 'monthly') cycleCap = 30;
        }
      }
    }

    // 3. Insert new streak
    const result = await pool.query(
      `INSERT INTO user_streaks (user_id, activity_type, rule_id, steak_added_date, is_streak)
       VALUES ($1, $2, $3, NOW(), 1)
       RETURNING *`,
      [userId, activityType, ruleId]
    );

    const newRecord = result.rows[0];

    // 4. Count current active streak length
    const countQuery = ruleId
      ? `SELECT COUNT(*) AS streak_count FROM user_streaks WHERE user_id = $1 AND rule_id = $2 AND is_streak = 1`
      : `SELECT COUNT(*) AS streak_count FROM user_streaks WHERE user_id = $1 AND activity_type = $2 AND is_streak = 1`;

    const countResult = await pool.query(countQuery, todayCheckParams);
    let streak_count = parseInt(countResult.rows[0].streak_count);

    // 5. Check if Cycle Cap Reached (e.g. 7/7) -> If hit, we need to mark them as completed/expired for the next day
    let cycle_completed = false;
    if (cycleCap && streak_count >= cycleCap) {
      cycle_completed = true;
      // The lazy evaluator will handle setting is_streak=0 on the *next* day before the next insertion,
      // so the user still sees "7/7" on the day they hit it.
    }

    const milestone_reached = MILESTONES.includes(streak_count) ? streak_count : null;

    return {
      record: newRecord,
      streak_count,     // Earned
      cycle_cap: cycleCap, // Total out of
      reward_points: rulePoints,
      activity_type: activityType,
      rule_id: ruleId,
      milestone_reached,
      is_milestone: !!milestone_reached,
      cycle_completed
    };
  }

  /**
   * Get streak info for a user, with lazy evaluation (auto-reset if missed days, OR if reached cycle cap).
   * Checks reward_management rules to determine reset logic and max caps.
   * Excludes 'daily_login' from this specific reset flow.
   * @param {number} userId
   * @param {string|null} activityType
   */
  static async getStreaks(userId, activityType = null) {
    // Build dynamic where clause
    const typeFilter = activityType
      ? `AND activity_type = $2`
      : "";
    const params = activityType ? [userId, activityType] : [userId];

    // 1. Fetch active reward rules to determine reset logic, caps & points
    const rulesRes = await pool.query(
      `SELECT module_type, events_per_day, frequency_limit, points_amount 
       FROM reward_management 
       WHERE is_active = true`
    );

    const resetTriggerTypes = new Set();
    const frequencyCaps = {};
    const rulePointsMap = {};

    for (const rule of rulesRes.rows) {
      if (!rule.module_type || rule.module_type === 'daily_login') continue;

      if (parseInt(rule.events_per_day) === 1) {
        resetTriggerTypes.add(rule.module_type);
      }

      // Map points for display
      rulePointsMap[rule.module_type] = rule.points_amount;

      if (rule.frequency_limit) {
        let cap = null;
        if (rule.frequency_limit.toLowerCase() === 'weekly') cap = 7;
        else if (rule.frequency_limit.toLowerCase() === 'monthly') cap = 30;

        if (cap) {
          frequencyCaps[rule.module_type] = cap;
        }
      }
    }

    // 2. Fetch current counts and last active dates per activity_type BEFORE updates
    // We need current counts to know if they hit the cap
    const currentRows = await pool.query(
      `SELECT activity_type,
              COUNT(*) AS current_streak,
              MAX(steak_added_date) AS last_activity_date
       FROM user_streaks
       WHERE user_id = $1 AND is_streak = 1 ${typeFilter.replace('$2', activityType ? '$2' : '')}
       GROUP BY activity_type`,
      params
    );

    const now = new Date();
    let expiredTypes = [];

    for (const row of currentRows.rows) {
      const lastDate = new Date(row.last_activity_date);
      const diffMs = now - lastDate;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const currentStreak = parseInt(row.current_streak);

      // Check 1: Missed a day & rule triggers reset
      if (diffDays > 1 && resetTriggerTypes.has(row.activity_type)) {
        expiredTypes.push(row.activity_type);
        logger.info(`Streak expired for user ${userId} activity: ${row.activity_type} (${diffDays} days gap, matched reward rule)`);
        continue;
      }

      // Check 2: Hit the frequency limit cap (e.g., 7 for weekly) AND it's a new day
      const cap = frequencyCaps[row.activity_type];
      if (cap && currentStreak >= cap && diffDays >= 1) {
        // We reached the limit previously, and now it's a new day, so reset to start the next cycle
        expiredTypes.push(row.activity_type);
        logger.info(`Streak cycle completed for user ${userId} activity: ${row.activity_type} (Reached cap: ${cap})`);
      }
    }

    // Reset expired / completed streaks
    if (expiredTypes.length > 0) {
      await pool.query(
        `UPDATE user_streaks SET is_streak = 0, updated_at = NOW()
         WHERE user_id = $1 AND is_streak = 1 AND activity_type = ANY($2)`,
        [userId, expiredTypes]
      );
    }

    // 3. Fetch UPDATED current counts per activity_type (post-expiration)
    const rows = await pool.query(
      `SELECT activity_type,
              COUNT(*) AS current_streak,
              MAX(steak_added_date) AS last_activity_date
       FROM user_streaks
       WHERE user_id = $1 AND is_streak = 1 ${typeFilter.replace('$2', activityType ? '$2' : '')}
       GROUP BY activity_type`,
      params
    );

    // 4. Fetch all-time best (longest streak ever per type)
    const bestRows = await pool.query(
      `SELECT activity_type, COUNT(*) AS total_days
       FROM user_streaks
       WHERE user_id = $1 ${typeFilter.replace('$2', activityType ? '$2' : '')}
       GROUP BY activity_type`,
      params
    );
    const bestMap = {};
    for (const r of bestRows.rows) {
      bestMap[r.activity_type] = parseInt(r.total_days);
    }

    // 5. Check today's activity per type
    const todayRows = await pool.query(
      `SELECT activity_type FROM user_streaks
       WHERE user_id = $1 AND is_streak = 1 ${typeFilter.replace('$2', activityType ? '$2' : '')}
         AND DATE(steak_added_date AT TIME ZONE 'UTC') = CURRENT_DATE`,
      params
    );
    const todaySet = new Set(todayRows.rows.map((r) => r.activity_type));

    // 6. Build response
    const streaks = rows.rows.map((r) => {
      const current = parseInt(r.current_streak);

      // If there's a cap, the next milestone is either a standard milestone OR the cap itself
      const cap = frequencyCaps[r.activity_type];
      let next_milestone = MILESTONES.find((m) => m > current && (!cap || m <= cap)) || null;
      if (cap && !next_milestone && current < cap) {
        next_milestone = cap;
      }

      return {
        activity_type: r.activity_type,
        current_streak: current,
        longest_streak: bestMap[r.activity_type] || current,
        last_activity_date: r.last_activity_date,
        is_active: true, // Only active streaks are returned from the currentRows query
        recorded_today: todaySet.has(r.activity_type),
        next_milestone,
        next_milestone_in: next_milestone ? next_milestone - current : null,
        cycle_cap: cap || null, // Expose the max cap if it exists
        reward_points: rulePointsMap[r.activity_type] || 0
      };
    });

    if (activityType) {
      return streaks[0] || {
        activity_type: activityType,
        current_streak: 0,
        longest_streak: 0,
        last_activity_date: null,
        is_active: false,
        recorded_today: false,
        next_milestone: MILESTONES[0],
        next_milestone_in: MILESTONES[0],
        cycle_cap: frequencyCaps[activityType] || null,
        reward_points: rulePointsMap[activityType] || 0
      };
    }

    return { streaks };
  }

  /**
   * Restore expired streaks (all or by activity_type)
   * @param {number} userId
   * @param {string|null} activityType
   */
  static async restoreStreaks(userId, activityType = null) {
    const typeCondition = activityType
      ? "AND activity_type = $2"
      : "";
    const params = activityType ? [userId, activityType] : [userId];

    const result = await pool.query(
      `UPDATE user_streaks
       SET is_streak = 1, is_restored = TRUE, updated_at = NOW()
       WHERE user_id = $1 AND is_streak = 0 ${typeCondition}
       RETURNING *`,
      params
    );

    return {
      restored_count: result.rowCount,
      activity_type: activityType || "all",
      records: result.rows,
    };
  }

  /**
   * Get a summary of all streak types for the user (home screen dashboard)
   * @param {number} userId
   */
  static async getSummary(userId) {
    const data = await this.getStreaks(userId, null);

    // Build a map from the streaks array
    const summaryMap = {};
    for (const s of data.streaks) {
      summaryMap[s.activity_type] = s;
    }

    // Ensure standard types always appear in summary
    const defaultTypes = ["workout", "meal", "general"];
    for (const type of defaultTypes) {
      if (!summaryMap[type]) {
        summaryMap[type] = {
          activity_type: type,
          current_streak: 0,
          longest_streak: 0,
          last_activity_date: null,
          is_active: false,
          recorded_today: false,
          next_milestone: MILESTONES[0],
          next_milestone_in: MILESTONES[0],
        };
      }
    }

    return Object.values(summaryMap);
  }
}

module.exports = StreakService;
