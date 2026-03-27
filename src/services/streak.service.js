const { pool } = require("../config/database");
const logger = require("../utils/logger");
const RewardService = require("./reward.service");
const NotificationService = require("./notification.service");

// Milestone days that trigger celebrations
const MILESTONES = [3, 7, 14, 30, 60, 90, 180, 365];

/**
 * Service for managing user streaks
 */
class StreakService {
  static async getRawStreakRecords(userId, activityType = null) {
    const typeFilter = activityType ? "AND activity_type = $2" : "";
    const params = activityType ? [userId, activityType] : [userId];
    const rows = await pool.query(
      `SELECT *
       FROM user_streaks
       WHERE user_id = $1 ${typeFilter}
       ORDER BY steak_added_date DESC, id DESC`,
      params
    );
    return rows.rows;
  }

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

    // 2. Fetch Rule Details (Match by ruleId OR activity_type)
    let rulePoints = 0;
    let cycleCap = null;
    let finalRuleId = ruleId;

    if (!finalRuleId) {
      // Auto-lookup rule by activity_type
      const autoRuleRes = await pool.query(
        `SELECT id FROM reward_management WHERE module_type = $1 AND is_active = true LIMIT 1`,
        [activityType]
      );
      if (autoRuleRes.rows.length > 0) {
        finalRuleId = autoRuleRes.rows[0].id;
        logger.info(`Auto-linked activity '${activityType}' to reward rule ${finalRuleId}`);
      }
    }

    if (finalRuleId) {
      const ruleRes = await pool.query(`SELECT * FROM reward_management WHERE id = $1`, [finalRuleId]);
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
      [userId, activityType, finalRuleId]
    );

    const newRecord = result.rows[0];

    // 3.5 Award Points if rule exists
    if (finalRuleId) {
      try {
        await RewardService.earnPoints(userId, finalRuleId);
      } catch (awardError) {
        logger.warn(`Failed to award points for rule ${finalRuleId}: ${awardError.message}`);
        // We continue anyway so the streak itself is still recorded
      }
    }

    // 4. Count current active streak length
    const countQuery = finalRuleId
      ? `SELECT COUNT(*) AS streak_count FROM user_streaks WHERE user_id = $1 AND rule_id = $2 AND is_streak = 1`
      : `SELECT COUNT(*) AS streak_count FROM user_streaks WHERE user_id = $1 AND activity_type = $2 AND is_streak = 1`;

    const countParams = finalRuleId ? [userId, finalRuleId] : [userId, activityType];
    const countResult = await pool.query(countQuery, countParams);
    let streak_count = parseInt(countResult.rows[0].streak_count);

    // 5. Check if Cycle Cap Reached (e.g. 7/7) -> If hit, we need to mark them as completed/expired for the next day
    let cycle_completed = false;
    if (cycleCap && streak_count >= cycleCap) {
      cycle_completed = true;
      // The lazy evaluator will handle setting is_streak=0 on the *next* day before the next insertion,
      // so the user still sees "7/7" on the day they hit it.
    }

    const milestone_reached = MILESTONES.includes(streak_count) ? streak_count : null;

    if (milestone_reached) {
      const rulePart = finalRuleId != null ? String(finalRuleId) : "norule";
      const milestoneKey = `streak:${activityType}:${rulePart}:${milestone_reached}`;
      try {
        await NotificationService.createMilestoneCelebration(
          userId,
          {
            milestone_key: milestoneKey,
            achievement_headline: `${milestone_reached}-day streak`,
            source: "streak",
          },
          { send_push: true, try_milestone_bonus: true }
        );
      } catch (notifyErr) {
        logger.warn(`Milestone celebration notification failed: ${notifyErr.message}`);
      }
    }

    // 6. Calculate total points and percentage
    const totalPointsRes = await pool.query(
      `SELECT COALESCE(SUM(points_amount), 0) as total FROM points_transaction 
       WHERE user_id = $1 AND rule_id = $2 AND type = 'earned'`,
      [userId, finalRuleId]
    );
    const total_earned_points = parseInt(totalPointsRes.rows[0].total);
    const percent_earned = cycleCap ? Math.min(Math.round((streak_count / cycleCap) * 100), 100) : 0;

    return {
      record: newRecord,
      streak_count,     // Earned
      cycle_cap: cycleCap, // Total out of
      reward_points: rulePoints,
      total_earned_points,
      percent_earned,
      activity_type: activityType,
      rule_id: finalRuleId,
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

    const ruleIdMap = {};
    for (const rule of rulesRes.rows) {
      if (!rule.module_type || rule.module_type === 'daily_login') continue;
      ruleIdMap[rule.module_type] = rule.id;

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
      `SELECT activity_type, rule_id,
              COUNT(*) AS current_streak,
              MAX(steak_added_date) AS last_activity_date
       FROM user_streaks
       WHERE user_id = $1 AND is_streak = 1 ${typeFilter.replace('$2', activityType ? '$2' : '')}
       GROUP BY activity_type, rule_id`,
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
      `SELECT activity_type, rule_id,
              COUNT(*) AS current_streak,
              MAX(steak_added_date) AS last_activity_date
       FROM user_streaks
       WHERE user_id = $1 AND is_streak = 1 ${typeFilter.replace('$2', activityType ? '$2' : '')}
       GROUP BY activity_type, rule_id`,
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

    // 5.5 Fetch total points per rule_id AND module_type
    const pointsRows = await pool.query(
      `SELECT rule_id, module_type, SUM(points_amount) as total_points
       FROM points_transaction
       WHERE user_id = $1 AND type = 'earned'
       GROUP BY rule_id, module_type`,
      [userId]
    );
    const pointsMapByRule = {};
    const pointsMapByType = {};
    for (const p of pointsRows.rows) {
      if (p.rule_id) pointsMapByRule[p.rule_id] = parseInt(p.total_points, 10);
      if (p.module_type) pointsMapByType[p.module_type] = parseInt(p.total_points, 10);
    }

    // 6. Build response
    const streaks = rows.rows.map((r) => {
      const current = parseInt(r.current_streak);

      // If there's a cap, the next milestone is either a standard milestone OR the cap itself
      const cap = frequencyCaps[r.activity_type];
      let next_milestone = MILESTONES.find((m) => m > current && (!cap || m <= cap)) || null;
      if (cap && !next_milestone && current < cap) {
        next_milestone = cap;
      }

      const total_earned = pointsMapByRule[r.rule_id || 0] || pointsMapByType[r.activity_type] || 0;
      const percent = cap ? Math.min(Math.round((current / cap) * 100), 100) : 0;
      const reward_points = rulePointsMap[r.activity_type] || 0;

      const readable = {
        current_streak_days: current,
        next_milestone_target_days: next_milestone,
        days_to_next_milestone: next_milestone ? next_milestone - current : null,
        streak_cycle_total_days: cap || null,
        points_per_activity: reward_points,
        total_points_earned: total_earned,
        current_cycle_points_earned: current * reward_points,
        cycle_progress_percent: percent,
      };

      return {
        activity_type: r.activity_type,
        rule_id: r.rule_id,
        ...readable,
        last_activity_date: r.last_activity_date,
        is_active: true, // Only active streaks are returned from the currentRows query
        recorded_today: todaySet.has(r.activity_type),
      };
    });

    if (activityType) {
      const s = streaks[0] || {
        activity_type: activityType,
        rule_id: null,
        current_streak_days: 0,
        next_milestone_target_days: MILESTONES[0],
        days_to_next_milestone: MILESTONES[0],
        streak_cycle_total_days: frequencyCaps[activityType] || null,
        points_per_activity: rulePointsMap[activityType] || 0,
        total_points_earned: pointsMapByRule[ruleIdMap[activityType]] || pointsMapByType[activityType] || 0,
        current_cycle_points_earned: 0,
        cycle_progress_percent: 0,
        last_activity_date: null,
        is_active: false,
        recorded_today: false,
      };
      const streak_records = await this.getRawStreakRecords(userId, activityType);
      return {
        ...s,
        streak_records,
      };
    }

    const streak_records = await this.getRawStreakRecords(userId, null);
    return { streaks, streak_records };
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
      summaryMap[s.activity_type] = {
        ...s,
        streak_records: [],
      };
    }

    // Ensure standard types always appear in summary
    const defaultTypes = ["workout", "meal", "general"];
    for (const type of defaultTypes) {
      if (!summaryMap[type]) {
        summaryMap[type] = {
          activity_type: type,
          current_streak_days: 0,
          next_milestone_target_days: MILESTONES[0],
          days_to_next_milestone: MILESTONES[0],
          streak_cycle_total_days: null,
          points_per_activity: 0,
          total_points_earned: 0,
          current_cycle_points_earned: 0,
          cycle_progress_percent: 0,
          last_activity_date: null,
          is_active: false,
          recorded_today: false,
          streak_records: [],
        };
      }
    }

    // Attach raw records under their own activity summary object
    const allRecords = data.streak_records || [];
    for (const rec of allRecords) {
      const key = rec.activity_type;
      if (!summaryMap[key]) {
        summaryMap[key] = {
          activity_type: key,
          current_streak_days: 0,
          next_milestone_target_days: MILESTONES[0],
          days_to_next_milestone: MILESTONES[0],
          streak_cycle_total_days: null,
          points_per_activity: 0,
          total_points_earned: 0,
          current_cycle_points_earned: 0,
          cycle_progress_percent: 0,
          last_activity_date: null,
          is_active: false,
          recorded_today: false,
          streak_records: [],
        };
      }
      summaryMap[key].streak_records.push(rec);
    }

    return {
      summary: Object.values(summaryMap),
    };
  }
}

module.exports = StreakService;
