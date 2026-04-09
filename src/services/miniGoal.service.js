const db = require("../config/database");
const logger = require("../utils/logger");
const RewardService = require("./reward.service");
const AppError = require("../utils/appError");
const { buildTimestampDateRangeFilter } = require("../utils/dateRange");

class MiniGoalService {
  static buildTodayFilterSql(alias = "mg") {
    // "Today" set for listing + daily completion:
    // - Both dates null → recurring every-day goal (applies every calendar day).
    // - Only start_date → active from that day onward (every day until end if any).
    // - Only end_date → active every day up to end_date.
    // - Both set → active when today is inside [start_date, end_date].
    return `(
      (${alias}.start_date IS NULL OR ${alias}.start_date <= CURRENT_DATE)
      AND (${alias}.end_date IS NULL OR ${alias}.end_date >= CURRENT_DATE)
    )`;
  }

  static async create(userId, data) {
    const { description, start_date, end_date, type, rule_id } = data;
    const titleClean = String(data.title ?? "").trim();
    if (!titleClean) {
      throw new AppError("Title is required", 400);
    }
    try {
      const dup = await db.query(
        `SELECT id FROM mini_goals
         WHERE user_id = $1 AND LOWER(TRIM(title)) = LOWER($2)
         LIMIT 1`,
        [userId, titleClean]
      );
      if (dup.rows.length > 0) {
        throw new AppError("A mini goal with this title already exists", 400);
      }

      const result = await db.query(
        `INSERT INTO mini_goals (user_id, title, description, start_date, end_date, type, rule_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [userId, titleClean, description, start_date, end_date, type || "custom", rule_id]
      );
      return result.rows[0];
    } catch (error) {
      if (error && error.code === "23505") {
        throw new AppError("A mini goal with this title already exists", 400);
      }
      logger.error(`Error creating mini goal: ${error.message}`);
      throw error;
    }
  }

  static async listByUser(userId, options = {}) {
    const { currentDayOnly = false, excludeSkipped = false, start_date, end_date } = options;
    try {
      const todayFilter = this.buildTodayFilterSql("mg");
      const parts = ["mg.user_id = $1"];
      const params = [userId];
      if (currentDayOnly) parts.push(`(${todayFilter})`);
      if (excludeSkipped) parts.push(`mg.status <> 'skipped'`);
      const dateFilter = buildTimestampDateRangeFilter(
        "mg.created_at",
        start_date,
        end_date,
        params.length + 1
      );
      if (dateFilter.clauses.length > 0) {
        parts.push(...dateFilter.clauses);
        params.push(...dateFilter.params);
      }
      const where = `WHERE ${parts.join(" AND ")}`;
      const result = await db.query(
        `SELECT *
         FROM mini_goals mg
         ${where}
         ORDER BY mg.created_at DESC`,
        params
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error listing mini goals: ${error.message}`);
      throw error;
    }
  }

  static async getById(userId, goalId) {
    try {
      const result = await db.query(
        "SELECT * FROM mini_goals WHERE id = $1 AND user_id = $2",
        [goalId, userId]
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error getting mini goal: ${error.message}`);
      throw error;
    }
  }

  static async updateStatus(userId, goalId, status, options = {}) {
    const { rule_id: bodyRuleId } = options;
    try {
      const goal = await this.getById(userId, goalId);
      if (!goal) throw new AppError("Mini goal not found", 404);

      if (goal.status === "completed") {
        throw new AppError("Mini goal is already completed", 400);
      }

      const result = await db.query(
        "UPDATE mini_goals SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *",
        [status, goalId, userId]
      );

      const updatedGoal = result.rows[0];

      const todayFilter = this.buildTodayFilterSql("mg");
      const todayStatsRes = await db.query(
        `SELECT
           COUNT(*)::int AS total_today,
           COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_today
         FROM mini_goals mg
         WHERE mg.user_id = $1
           AND ${todayFilter}`,
        [userId]
      );
      const stats = todayStatsRes.rows[0] || { total_today: 0, completed_today: 0 };
      const totalToday = Number(stats.total_today) || 0;
      const completedToday = Number(stats.completed_today) || 0;
      updatedGoal.all_todays_goals_completed =
        totalToday > 0 && completedToday === totalToday;

      // Award points once per day only when all today's goals are completed.
      if (status === "completed" && updatedGoal.all_todays_goals_completed) {
        try {
          const awardedTodayRes = await db.query(
            `SELECT 1
             FROM points_transaction
             WHERE user_id = $1
               AND type = 'earned'
               AND module_type = 'mini_goal_daily_completion'
               AND created_at::date = CURRENT_DATE
             LIMIT 1`,
            [userId]
          );

          if (awardedTodayRes.rows.length === 0) {
            let ruleId = null;
            const parsedBodyRule =
              bodyRuleId !== undefined && bodyRuleId !== null && bodyRuleId !== ""
                ? Number(bodyRuleId)
                : NaN;
            if (Number.isInteger(parsedBodyRule) && parsedBodyRule > 0) {
              ruleId = parsedBodyRule;
            } else {
              const ruleRes = await db.query(
                `SELECT rule_id
                 FROM mini_goals mg
                 WHERE mg.user_id = $1
                   AND ${todayFilter}
                   AND mg.rule_id IS NOT NULL
                 ORDER BY mg.updated_at DESC, mg.id DESC
                 LIMIT 1`,
                [userId]
              );
              ruleId = ruleRes.rows[0]?.rule_id ?? null;
            }

            if (ruleId) {
              // Same path as POST /api/rewards/earn { rule_id }
              const earning = await RewardService.earnPoints(userId, ruleId);

              // Mark this completion row as the one that triggered today's award.
              await db.query(
                "UPDATE mini_goals SET points_awarded = $1 WHERE id = $2",
                [earning.points, goalId]
              );

              // Tag transaction so we only award once per day for mini-goal completion.
              await db.query(
                `UPDATE points_transaction
                 SET module_type = 'mini_goal_daily_completion'
                 WHERE id = (
                   SELECT id
                   FROM points_transaction
                   WHERE user_id = $1
                     AND type = 'earned'
                     AND rule_id = $2
                   ORDER BY created_at DESC
                   LIMIT 1
                 )`,
                [userId, ruleId]
              );

              updatedGoal.points_awarded = earning.points;
              updatedGoal.daily_completion_reward = {
                rule_id: ruleId,
                points: earning.points,
                earned: earning.earned,
              };
            }
          }
        } catch (rewardError) {
          logger.warn(`Failed to award points for mini goal ${goalId}: ${rewardError.message}`);
        }
      }

      return updatedGoal;
    } catch (error) {
      logger.error(`Error updating mini goal status: ${error.message}`);
      throw error;
    }
  }

  static async delete(userId, goalId) {
    try {
      const result = await db.query(
        "DELETE FROM mini_goals WHERE id = $1 AND user_id = $2 RETURNING *",
        [goalId, userId]
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error deleting mini goal: ${error.message}`);
      throw error;
    }
  }
}

module.exports = MiniGoalService;
