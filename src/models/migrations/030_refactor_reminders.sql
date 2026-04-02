-- Migration: Refactor reminders to generic schema
-- 1. Create the new generic user_reminders table
CREATE TABLE IF NOT EXISTS user_reminders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminder_type VARCHAR(50) NOT NULL,
  reminder_time TIME NOT NULL,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7),
  is_enabled BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_reminders_user_type ON user_reminders(user_id, reminder_type);

-- 2. Migrate existing data from reminder_settings to user_reminders
-- Morning Briefing
INSERT INTO user_reminders (user_id, reminder_type, reminder_time, is_enabled)
SELECT user_id, 'morning_briefing', morning_briefing_time, morning_briefing_enabled
FROM reminder_settings
ON CONFLICT DO NOTHING;

-- Workout Reminder
INSERT INTO user_reminders (user_id, reminder_type, reminder_time, is_enabled)
SELECT user_id, 'workout', workout_reminder_time, workout_reminder_enabled
FROM reminder_settings
ON CONFLICT DO NOTHING;

-- Daily Motivation
INSERT INTO user_reminders (user_id, reminder_type, reminder_time, is_enabled)
SELECT user_id, 'daily_motivation', daily_motivation_time, daily_motivation_enabled
FROM reminder_settings
ON CONFLICT DO NOTHING;

-- Weekly Weigh-in
INSERT INTO user_reminders (user_id, reminder_type, reminder_time, day_of_week, is_enabled)
SELECT user_id, 'weekly_weigh_in', weekly_weigh_in_time, weekly_weigh_in_day_of_week, weekly_weigh_in_enabled
FROM reminder_settings
WHERE weekly_weigh_in_day_of_week IS NOT NULL
ON CONFLICT DO NOTHING;

-- Meal Reminders (requires unnesting the JSONB array if we want separate rows, or we can handle it later in API)
-- For now, let's just use a simple migration for meals if they exist
DO $$
DECLARE
    r RECORD;
    m_time TEXT;
BEGIN
    FOR r IN SELECT user_id, meal_reminder_times, meal_reminders_enabled FROM reminder_settings LOOP
        IF r.meal_reminder_times IS NOT NULL THEN
            FOR m_time IN SELECT jsonb_array_elements_text(r.meal_reminder_times) LOOP
                INSERT INTO user_reminders (user_id, reminder_type, reminder_time, is_enabled)
                VALUES (r.user_id, 'meal', m_time::TIME, r.meal_reminders_enabled);
            END LOOP;
        END IF;
    END LOOP;
END $$;

-- 3. Cleanup reminder_settings table
-- Keep only user_id and do_not_disturb_enabled
ALTER TABLE reminder_settings 
  DROP COLUMN IF EXISTS morning_briefing_enabled,
  DROP COLUMN IF EXISTS morning_briefing_time,
  DROP COLUMN IF EXISTS workout_reminder_enabled,
  DROP COLUMN IF EXISTS workout_reminder_time,
  DROP COLUMN IF EXISTS meal_reminders_enabled,
  DROP COLUMN IF EXISTS meal_reminder_times,
  DROP COLUMN IF EXISTS weekly_weigh_in_enabled,
  DROP COLUMN IF EXISTS weekly_weigh_in_day_of_week,
  DROP COLUMN IF EXISTS weekly_weigh_in_time,
  DROP COLUMN IF EXISTS daily_motivation_enabled,
  DROP COLUMN IF EXISTS daily_motivation_time;
