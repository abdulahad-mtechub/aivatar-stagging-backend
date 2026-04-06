const admin = require("../config/firebase");
const db = require("../config/database");
const logger = require("../utils/logger");

class NotificationService {
  /**
   * Static notification templates (Figma-aligned, backend-controlled)
   * type -> { title, body }
   */
  static TEMPLATES = {
    updated_meal: {
      title: "Updated Meal",
      body: "Your meal plan has been updated. Tap to view your updated plan."
    },
    missed_workout: {
      title: "Missed Workout",
      body: "You missed today’s workout session. Tap to reschedule or do a quick session."
    },
    great_progress: {
      title: "Great Progress",
      body: "You’re making great progress. Keep going—consistency wins."
    },
    daily_briefing: {
      title: "Daily Briefing",
      body: "Here’s your plan for today. Tap to view your meals, workouts, and goals."
    },
    weekly_weigh_check: {
      title: "Weekly Weigh Check",
      body: "It’s time for your weekly weigh‑in. Tap to record your measurement."
    },
    milestone_achieved: {
      title: "Milestone Achieved",
      body: "Milestone achieved! Tap to see your updated stats and rewards."
    },
    milestone_celebration: {
      title: "Milestone celebration!",
      body:
        "You crushed a major milestone—tap to celebrate in the app and keep the momentum going."
    },
    re_engagement: {
      title: "Re‑engagement",
      body: "We haven’t seen you in a while. Tap to get back on track today."
    }
  };

  /**
   * Create an in-app notification row (and optionally send push).
   * Text is static, chosen by `type`.
   */
  static async createNotification(userId, type, metadata = {}, options = {}) {
    const template = NotificationService.TEMPLATES[type];
    if (!template) {
      throw new Error(`Unknown notification type: ${type}`);
    }

    const { send_push = false } = options;

    const res = await db.query(
      `INSERT INTO notifications (user_id, type, title, body, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, type, template.title, template.body, metadata || {}]
    );

    const row = res.rows[0];
    if (send_push) {
      try {
        await this.sendToUser(userId, template.title, template.body, {
          type,
          notification_id: String(row.id),
          ...Object.fromEntries(
            Object.entries(metadata || {}).map(([k, v]) => [k, String(v)])
          )
        });
      } catch (e) {
        // Keep in-app notification even if push fails
        logger.warn(`Push failed for notification ${row.id}: ${e.message}`);
      }
    }

    return row;
  }

  /**
   * Build high-energy copy for achievement milestones (weight, streaks, goals).
   * Optional credits/discount lines when provided (or when try_milestone_bonus awards points).
   */
  static buildMilestoneCelebrationCopy({
    achievement_headline,
    credits,
    discount_hint,
  }) {
    const headline =
      achievement_headline && String(achievement_headline).trim()
        ? String(achievement_headline).trim()
        : "a huge milestone";

    const title = "Milestone celebration!";
    let body = `You crushed it—you hit ${headline}! That kind of progress deserves a real shout-out.`;

    const n = Number(credits);
    if (Number.isFinite(n) && n > 0) {
      body += ` We added ${Math.round(n)} app credits to your account.`;
    }

    const hint = discount_hint && String(discount_hint).trim();
    if (hint) {
      body += ` ${hint}`;
    }

    body += " Open the app to soak it in and keep going strong.";
    return { title, body };
  }

  static async milestoneCelebrationExists(userId, milestoneKey) {
    if (!milestoneKey) return false;
    const res = await db.query(
      `SELECT 1 FROM notifications
       WHERE user_id = $1 AND type = 'milestone_celebration'
         AND metadata->>'milestone_key' = $2
       LIMIT 1`,
      [userId, String(milestoneKey)]
    );
    return res.rows.length > 0;
  }

  /**
   * In-app + optional push for a specific user's achievement.
   * @param {object} params
   * @param {string} params.milestone_key - Stable id for deduplication (e.g. weight_loss:5, streak:workout:7:7)
   * @param {string} params.achievement_headline - Short phrase, e.g. "5 kg down from your starting weight"
   * @param {string} [params.source] - e.g. weight | streak | goal
   * @param {number} [params.credits] - If set, mentioned in body (and can stack with try_milestone_bonus)
   * @param {string} [params.discount_hint] - Optional discount/promo line appended to body
   * @param {object} [options]
   * @param {boolean} [options.send_push=true]
   * @param {boolean} [options.try_milestone_bonus=false] - If true, attempts reward_management rule module_type milestone_celebration
   * @returns {Promise<object|null>} notification row or null if skipped (duplicate key)
   */
  static async createMilestoneCelebration(userId, params = {}, options = {}) {
    const {
      milestone_key,
      achievement_headline,
      source,
      credits: creditsParam,
      discount_hint,
    } = params;

    const { send_push = true, try_milestone_bonus = false } = options;

    if (!milestone_key) {
      throw new Error("milestone_key is required for milestone celebration notifications");
    }

    if (await this.milestoneCelebrationExists(userId, milestone_key)) {
      return null;
    }

    let credits = creditsParam;
    if (try_milestone_bonus && (!Number.isFinite(Number(credits)) || Number(credits) <= 0)) {
      try {
        const RewardService = require("./reward.service");
        const ruleRes = await db.query(
          `SELECT id, points_amount FROM reward_management
           WHERE module_type = $1 AND is_active = true
           LIMIT 1`,
          ["milestone_celebration"]
        );
        if (ruleRes.rows[0]) {
          const out = await RewardService.earnPoints(userId, ruleRes.rows[0].id);
          credits = out.points;
        }
      } catch (e) {
        logger.warn(`Milestone bonus not awarded: ${e.message}`);
      }
    }

    const { title, body } = this.buildMilestoneCelebrationCopy({
      achievement_headline,
      credits,
      discount_hint,
    });

    const metadata = {
      milestone_key: String(milestone_key),
      source: source || null,
      achievement_headline: achievement_headline || null,
      credits_awarded:
        Number.isFinite(Number(credits)) && Number(credits) > 0
          ? Math.round(Number(credits))
          : null,
      discount_hint: discount_hint || null,
    };

    const res = await db.query(
      `INSERT INTO notifications (user_id, type, title, body, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, "milestone_celebration", title, body, metadata]
    );

    const row = res.rows[0];

    if (send_push) {
      try {
        await this.sendToUser(userId, title, body, {
          type: "milestone_celebration",
          notification_id: String(row.id),
          milestone_key: String(milestone_key),
          source: source ? String(source) : "",
        });
      } catch (e) {
        logger.warn(`Push failed for milestone celebration ${row.id}: ${e.message}`);
      }
    }

    return row;
  }

  /**
   * Create a custom in-app notification (title/body from frontend),
   * and optionally send push via FCM to the same user.
   */
  /**
   * Create the same in-app notification for every active app user (not deleted, not blocked, role user),
   * then send push where an FCM token exists. Admin-only at route layer.
   */
  static async broadcastToActiveUsers(payload = {}, options = {}) {
    const {
      type = "custom",
      title,
      body,
      metadata = {},
    } = payload;
    const { send_push = true } = options;

    if (!title || !body) {
      throw new Error("title and body are required");
    }

    const metaJson = JSON.stringify(metadata || {});

    const res = await db.query(
      `WITH inserted AS (
         INSERT INTO notifications (user_id, type, title, body, metadata)
         SELECT u.id, $1, $2, $3, $4::jsonb
         FROM users u
         WHERE u.deleted_at IS NULL
           AND u.block_status = false
           AND u.role = 'user'
         RETURNING id, user_id
       )
       SELECT inserted.id AS notification_id, inserted.user_id, u.fcm_token
       FROM inserted
       JOIN users u ON u.id = inserted.user_id`,
      [type, title, body, metaJson]
    );

    const rows = res.rows;
    const total_users = rows.length;
    let push_attempted = 0;
    let push_success = 0;
    let push_failed = 0;

    if (send_push && rows.length > 0) {
      const dataBase = {
        type,
        ...Object.fromEntries(
          Object.entries(metadata || {}).map(([k, v]) => [k, String(v)])
        ),
      };

      const withToken = rows.filter((r) => r.fcm_token && String(r.fcm_token).trim());
      push_attempted = withToken.length;

      const BATCH = 500;
      for (let i = 0; i < withToken.length; i += BATCH) {
        const batch = withToken.slice(i, i + BATCH);
        const messages = batch.map((r) => ({
          notification: { title, body },
          token: r.fcm_token,
          data: {
            ...dataBase,
            notification_id: String(r.notification_id),
            user_id: String(r.user_id),
          },
        }));
        try {
          const response = await admin.messaging().sendEach(messages);
          push_success += response.successCount;
          push_failed += response.failureCount;
        } catch (e) {
          logger.error(`Broadcast push batch failed: ${e.message}`);
          push_failed += batch.length;
        }
      }
    }

    return {
      total_users,
      notifications_created: total_users,
      push_attempted,
      push_success,
      push_failed,
    };
  }

  static async createCustomNotification(userId, payload = {}, options = {}) {
    const {
      type = "custom",
      title,
      body,
      metadata = {},
    } = payload;

    if (!title || !body) {
      throw new Error("title and body are required");
    }

    const { send_push = true } = options;

    const res = await db.query(
      `INSERT INTO notifications (user_id, type, title, body, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, type, title, body, metadata || {}]
    );

    const row = res.rows[0];

    if (send_push) {
      try {
        await this.sendToUser(userId, title, body, {
          type,
          notification_id: String(row.id),
          ...Object.fromEntries(
            Object.entries(metadata || {}).map(([k, v]) => [k, String(v)])
          )
        });
      } catch (e) {
        logger.warn(`Push failed for custom notification ${row.id}: ${e.message}`);
      }
    }

    return row;
  }

  static async list(userId, options = {}) {
    const { tab = "all", limit = 50, offset = 0 } = options;
    const where = ["user_id = $1"];
    const params = [userId];

    if (String(tab).toLowerCase() === "unread") {
      where.push("is_read = false");
    }

    params.push(Number(limit));
    params.push(Number(offset));

    const res = await db.query(
      `SELECT *
       FROM notifications
       WHERE ${where.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.rows;
  }

  static async getSentByAdmin(options = {}) {
    const { limit = 50, offset = 0 } = options;
    const res = await db.query(
      `SELECT title, body, MIN(created_at) as created_at, COUNT(user_id)::integer as recipients_count
       FROM notifications
       WHERE type = 'custom'
       GROUP BY title, body
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [Number(limit), Number(offset)]
    );
    return res.rows;
  }

  static async markRead(userId, notificationId) {
    const res = await db.query(
      `UPDATE notifications
       SET is_read = true, read_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [notificationId, userId]
    );
    return res.rows[0] || null;
  }

  static async markAllRead(userId) {
    await db.query(
      `UPDATE notifications
       SET is_read = true, read_at = NOW()
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    return true;
  }

  /**
   * Send a push notification to a specific token
   */
  static async sendPushNotification(token, title, body, data = {}) {
    if (!token) return;

    const message = {
      notification: {
        title,
        body,
      },
      data,
      token,
    };

    try {
      const response = await admin.messaging().send(message);
      logger.info(`Successfully sent message: ${response}`);
      return response;
    } catch (error) {
      logger.error(`Error sending push notification: ${error.message}`);
      // If token is invalid or expired, we might want to clear it from the user record
      if (error.code === 'messaging/registration-token-not-registered') {
        logger.warn(`Token ${token} is no longer valid.`);
      }
      throw error;
    }
  }

  /**
   * Send a push notification to a user by their ID
   */
  static async sendToUser(userId, title, body, data = {}) {
    try {
      const result = await db.query(
        "SELECT fcm_token FROM users WHERE id = $1 AND deleted_at IS NULL",
        [userId]
      );

      const fcmToken = result.rows[0]?.fcm_token;
      if (!fcmToken) {
        logger.warn(`No FCM token found for user ${userId}`);
        return null;
      }

      return await this.sendPushNotification(fcmToken, title, body, data);
    } catch (error) {
      logger.error(`Error sending notification to user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a user's FCM token
   */
  static async updateFcmToken(userId, token) {
    try {
      await db.query(
        "UPDATE users SET fcm_token = $1, updated_at = NOW() WHERE id = $2",
        [token, userId]
      );
      return true;
    } catch (error) {
      logger.error(`Error updating FCM token for user ${userId}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = NotificationService;
