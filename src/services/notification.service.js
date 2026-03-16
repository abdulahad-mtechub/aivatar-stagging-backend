const admin = require("../config/firebase");
const db = require("../config/database");
const logger = require("../utils/logger");

class NotificationService {
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
