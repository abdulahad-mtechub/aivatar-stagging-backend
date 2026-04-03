const db = require('../config/database');
const NotificationService = require('./notification.service');
const { getNotificationTemplate } = require('../constants/notification.constants');
const logger = require('../utils/logger');

class CronService {
  static async init() {
    const isRunningOnDeno = typeof Deno !== 'undefined';

    if (isRunningOnDeno) {
      // ✅ Deno built-in cron (no import needed — Deno 2.x native)
      logger.info('Initializing CRON jobs with Deno.cron (built-in)...');
      Deno.cron('scheduled-reminders', '* * * * *', async () => {
        logger.info('⏳ Deno Cron triggered: Checking for scheduled reminders...');
        await CronService.processScheduledReminders();
      });
      logger.info('✅ Deno Cron jobs initialized successfully.');
    } else {
      // ✅ Node.js fallback using node-cron
      logger.info('Initializing CRON jobs with Node Cron...');
      const cron = require('node-cron');
      cron.schedule('* * * * *', async () => {
        logger.info('⏳ Node Cron triggered: Checking for scheduled reminders...');
        await CronService.processScheduledReminders();
      });
      logger.info('✅ Node Cron jobs initialized successfully.');
    }

    // TEMPORARY: trigger once after 1 minute for testing
    setTimeout(async () => {
      logger.info('⏳ Temporary 1-minute test trigger executing...');
      await CronService.processScheduledReminders();
    }, 60 * 1000);
  }

  /**
   * Highly optimized function to fetch all reminders due right NOW 
   * in each user's specific timezone and dispatch notifications.
   */
  static async processScheduledReminders() {
    try {
      // Find all enabled reminders (ignoring DND enabled ones).
      // Matches the users whose local time matches the reminder_time hour/minute precisely.
      const query = `
        SELECT r.user_id, r.reminder_type, r.metadata
        FROM reminder_settings r
        WHERE r.is_enabled = true
          AND r.do_not_disturb_enabled = false
          AND r.timezone IS NOT NULL
          AND EXTRACT(HOUR FROM CURRENT_TIMESTAMP AT TIME ZONE r.timezone) = EXTRACT(HOUR FROM r.reminder_time)
          AND EXTRACT(MINUTE FROM CURRENT_TIMESTAMP AT TIME ZONE r.timezone) = EXTRACT(MINUTE FROM r.reminder_time)
          AND (
            r.reminder_type != 'weekly_weigh_in' 
            OR (
                r.reminder_type = 'weekly_weigh_in'
                AND r.day_of_week = EXTRACT(ISODOW FROM CURRENT_TIMESTAMP AT TIME ZONE r.timezone)
            )
          )
      `;

      const res = await db.query(query);
      const dueReminders = res.rows;

      if (dueReminders.length === 0) return;

      logger.info(`Found ${dueReminders.length} reminders due right now. Dispatching...`);

      // Fire notifications in parallel
      const notificationPromises = dueReminders.map((reminder) => {
        const template = getNotificationTemplate(reminder.reminder_type);
        
        return NotificationService.createCustomNotification(
          reminder.user_id,
          {
            type: template.module, // e.g. 'workouts'
            title: template.title, // e.g. 'Workout Reminder'
            body: template.body,   // e.g. 'Did you complete your training...'
            metadata: {
              event: template.event,
              ...reminder.metadata
            }
          },
          { send_push: true }
        ).catch(err => {
          logger.error(`Failed to send ${reminder.reminder_type} to user ${reminder.user_id}: ${err.message}`);
        });
      });

      await Promise.allSettled(notificationPromises);
      logger.info(`Successfully processed ${dueReminders.length} reminders.`);

    } catch (error) {
      logger.error(`CRON processScheduledReminders Error: ${error.message}`);
    }
  }
}

module.exports = CronService;
