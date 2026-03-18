const db = require("../config/database");
const logger = require("../utils/logger");

class ReminderService {
  static async getOrCreate(userId) {
    try {
      const existing = await db.query(
        `SELECT * FROM reminder_settings WHERE user_id = $1`,
        [userId]
      );
      if (existing.rows[0]) return existing.rows[0];

      const created = await db.query(
        `INSERT INTO reminder_settings (user_id) VALUES ($1) RETURNING *`,
        [userId]
      );
      return created.rows[0];
    } catch (error) {
      logger.error(`Error getting reminder settings: ${error.message}`);
      throw error;
    }
  }

  static async update(userId, updateData) {
    const allowed = [
      "do_not_disturb_enabled",
      "dnd_start_time",
      "dnd_end_time",
      "morning_briefing_enabled",
      "morning_briefing_time",
      "workout_reminder_enabled",
      "workout_reminder_time",
      "meal_reminders_enabled",
      "meal_reminder_times",
      "weekly_weigh_in_enabled",
      "weekly_weigh_in_day_of_week",
      "weekly_weigh_in_time",
      "daily_motivation_enabled",
      "daily_motivation_time"
    ];

    const keys = Object.keys(updateData || {}).filter(
      (k) => allowed.includes(k) && updateData[k] !== undefined
    );
    if (keys.length === 0) return null;

    // Normalize JSONB fields
    const normalized = { ...(updateData || {}) };
    if (normalized.meal_reminder_times !== undefined) {
      if (normalized.meal_reminder_times === null) {
        // allow clearing to null if needed
      } else if (Array.isArray(normalized.meal_reminder_times)) {
        normalized.meal_reminder_times = JSON.stringify(normalized.meal_reminder_times);
      } else if (typeof normalized.meal_reminder_times === "string") {
        // Accept JSON string from clients, but validate it is JSON array
        try {
          const parsed = JSON.parse(normalized.meal_reminder_times);
          if (!Array.isArray(parsed)) {
            throw new Error("meal_reminder_times must be a JSON array");
          }
          normalized.meal_reminder_times = JSON.stringify(parsed);
        } catch (e) {
          throw new Error("Invalid meal_reminder_times JSON");
        }
      } else {
        throw new Error("meal_reminder_times must be an array of HH:MM strings");
      }
    }

    // Ensure row exists
    await this.getOrCreate(userId);

    const clauses = keys.map((k, idx) => `${k} = $${idx + 2}`);
    clauses.push("updated_at = NOW()");

    const values = [userId, ...keys.map((k) => normalized[k])];

    try {
      const res = await db.query(
        `UPDATE reminder_settings SET ${clauses.join(", ")}
         WHERE user_id = $1
         RETURNING *`,
        values
      );
      return res.rows[0] || null;
    } catch (error) {
      logger.error(`Error updating reminder settings: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ReminderService;

