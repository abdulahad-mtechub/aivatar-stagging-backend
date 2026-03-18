-- Migration: Reminders + In-app Notifications
-- Created at: 2026-03-18

-- --------------------------
-- 1) Reminder Settings (per user)
-- --------------------------
CREATE TABLE IF NOT EXISTS reminder_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  do_not_disturb_enabled BOOLEAN DEFAULT false,
  dnd_start_time TIME, -- e.g. 22:00
  dnd_end_time TIME,   -- e.g. 07:00

  morning_briefing_enabled BOOLEAN DEFAULT true,
  morning_briefing_time TIME DEFAULT '07:00',

  workout_reminder_enabled BOOLEAN DEFAULT true,
  workout_reminder_time TIME DEFAULT '18:00',

  meal_reminders_enabled BOOLEAN DEFAULT true,
  meal_reminder_times JSONB DEFAULT '["08:00","13:00","20:00"]'::jsonb, -- array of HH:MM

  weekly_weigh_in_enabled BOOLEAN DEFAULT false,
  weekly_weigh_in_day_of_week INTEGER CHECK (weekly_weigh_in_day_of_week BETWEEN 1 AND 7), -- 1=Mon..7=Sun
  weekly_weigh_in_time TIME DEFAULT '07:00',

  daily_motivation_enabled BOOLEAN DEFAULT true,
  daily_motivation_time TIME DEFAULT '09:00',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminder_settings_user_id ON reminder_settings(user_id);

-- --------------------------
-- 2) In-app Notifications (static text templates)
-- --------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  type VARCHAR(50) NOT NULL,            -- e.g. 'missed_workout', 'great_progress'
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,

  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,

  metadata JSONB DEFAULT '{}'::jsonb,   -- optional extra info (workout_id etc.)
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

