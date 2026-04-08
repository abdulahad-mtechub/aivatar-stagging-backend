const db = require("../config/database");
const logger = require("../utils/logger");

class ReminderService {
  static async getOrCreate(userId) {
    try {
      const res = await db.query(
        `SELECT * FROM reminder_settings WHERE user_id = $1 ORDER BY reminder_time ASC`,
        [userId]
      );
      
      const do_not_disturb_enabled = res.rows.length > 0 ? res.rows[0].do_not_disturb_enabled : false;

      return {
        user_id: userId,
        do_not_disturb_enabled,
        reminders: res.rows
      };
    } catch (error) {
      logger.error(`Error getting generic reminder settings: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update global settings and/or list of reminders
   */
  static async update(userId, updateData) {
    const { do_not_disturb_enabled, reminders } = updateData;
    
    try {
      // 1. Update global DND setting across all rows if provided
      if (do_not_disturb_enabled !== undefined) {
        await db.query(
          `UPDATE reminder_settings SET do_not_disturb_enabled = $1, updated_at = NOW() WHERE user_id = $2`,
          [do_not_disturb_enabled, userId]
        );
      }

      // 2. Handle reminders list if provided
      if (Array.isArray(reminders)) {
        // Fetch current global context (DND and timezone) to inherit it
        let currentDnd = false;
        let currentTimezone = null;
        
        if (do_not_disturb_enabled !== undefined) {
            currentDnd = do_not_disturb_enabled;
        }
        
        const checkRes = await db.query(`SELECT do_not_disturb_enabled, timezone FROM reminder_settings WHERE user_id = $1 LIMIT 1`, [userId]);
        if (checkRes.rows.length > 0) {
            if (do_not_disturb_enabled === undefined) currentDnd = checkRes.rows[0].do_not_disturb_enabled;
            currentTimezone = checkRes.rows[0].timezone; // In case we want to retain it if not passed
        }

        // Full sync
        await db.query(`DELETE FROM reminder_settings WHERE user_id = $1`, [userId]);
        
        for (const r of reminders) {
          const { reminder_type, reminder_time, day_of_week, is_enabled, timezone, metadata } = r;
          if (reminder_type) {
            await db.query(
              `INSERT INTO reminder_settings (user_id, reminder_type, reminder_time, day_of_week, is_enabled, do_not_disturb_enabled, timezone, metadata)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [userId, reminder_type, reminder_time, day_of_week || null, is_enabled ?? true, currentDnd, timezone || currentTimezone, metadata || '{}']
            );
          }
        }
      }

      return await this.getOrCreate(userId);
    } catch (error) {
      logger.error(`Error updating generic reminder settings: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add a single reminder
   */
  static async addReminder(userId, reminderData) {
    const { reminder_type, reminder_time, day_of_week, is_enabled, timezone, metadata } = reminderData;
    try {
      // Get current DND and timezone state
      const checkRes = await db.query(`SELECT do_not_disturb_enabled, timezone FROM reminder_settings WHERE user_id = $1 LIMIT 1`, [userId]);
      const currentDnd = checkRes.rows.length > 0 ? checkRes.rows[0].do_not_disturb_enabled : false;
      const currentTimezone = checkRes.rows.length > 0 ? checkRes.rows[0].timezone : null;

      const res = await db.query(
        `INSERT INTO reminder_settings (user_id, reminder_type, reminder_time, day_of_week, is_enabled, do_not_disturb_enabled, timezone, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [userId, reminder_type, reminder_time, day_of_week || null, is_enabled ?? true, currentDnd, timezone || currentTimezone, metadata || '{}']
      );
      return res.rows[0];
    } catch (error) {
      logger.error(`Error adding single reminder: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bulk add reminders (without deleting existing ones)
   */
  static async bulkAddReminders(userId, remindersList) {
    if (!Array.isArray(remindersList)) return [];
    try {
      const added = [];
      for (const r of remindersList) {
        const item = await this.addReminder(userId, r);
        added.push(item);
      }
      return added;
    } catch (error) {
      logger.error(`Error bulk adding reminders: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a single reminder by ID
   */
  static async updateReminder(userId, reminderId, updateData) {
    const { reminder_type, reminder_time, day_of_week, is_enabled, timezone, metadata } = updateData;
    try {
      const res = await db.query(
        `UPDATE reminder_settings SET
          reminder_type = COALESCE($1, reminder_type),
          reminder_time = COALESCE($2, reminder_time),
          day_of_week = COALESCE($3, day_of_week),
          is_enabled = COALESCE($4, is_enabled),
          timezone = COALESCE($5, timezone),
          metadata = COALESCE($6, metadata),
          updated_at = NOW()
         WHERE user_id = $7 AND id = $8
         RETURNING *`,
        [reminder_type, reminder_time, day_of_week, is_enabled, timezone, metadata, userId, reminderId]
      );
      return res.rows[0];
    } catch (error) {
      logger.error(`Error updating single reminder: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete single reminder
   */
  static async deleteReminder(userId, reminderId) {
    try {
      const res = await db.query(
        `DELETE FROM reminder_settings WHERE user_id = $1 AND id = $2 RETURNING *`,
        [userId, reminderId]
      );
      return res.rows[0];
    } catch (error) {
      logger.error(`Error deleting single reminder: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate total alerts scheduled from generic reminders
   */
  static calculateScheduledAlerts(data) {
    if (!data || !Array.isArray(data.reminders)) return 0;
    // Only count enabled reminders
    return data.reminders.filter(r => r.is_enabled).length;
  }
}

module.exports = ReminderService;

