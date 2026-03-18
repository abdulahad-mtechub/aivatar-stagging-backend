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
   * Create a custom in-app notification (title/body from frontend),
   * and optionally send push via FCM to the same user.
   */
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
