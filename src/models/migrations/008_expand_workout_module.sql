-- Migration: Expand Workout Module (video/rest + workout plans)
-- Created at: 2026-03-18

-- --------------------------
-- 1) Exercises enhancements
-- --------------------------
ALTER TABLE exercises
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
ADD COLUMN IF NOT EXISTS equipment VARCHAR(100),
ADD COLUMN IF NOT EXISTS difficulty VARCHAR(50),
ADD COLUMN IF NOT EXISTS default_rest_time_seconds INTEGER;

-- Backfill video_url from existing media_url when present
UPDATE exercises
SET video_url = COALESCE(video_url, media_url)
WHERE video_url IS NULL AND media_url IS NOT NULL;

-- --------------------------
-- 2) Workouts enhancements
-- --------------------------
ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS workout_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS estimated_calories INTEGER;

-- --------------------------
-- 3) Workout ↔ Exercise mapping enhancements
-- --------------------------
ALTER TABLE workout_exercises
ADD COLUMN IF NOT EXISTS rest_time_seconds INTEGER,
ADD COLUMN IF NOT EXISTS exercise_duration_seconds INTEGER,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- --------------------------
-- 4) User Workout Plans (AI-generated / scheduled)
-- --------------------------
CREATE TABLE IF NOT EXISTS workout_plans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id INTEGER REFERENCES workouts(id) ON DELETE SET NULL,
  week_number INTEGER NOT NULL DEFAULT 1,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Mon, 7=Sun
  plan_date DATE, -- Optional: specific calendar date
  slot_type VARCHAR(20) NOT NULL DEFAULT 'workout', -- for future flexibility
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'missed', 'skipped'
  is_skipped BOOLEAN DEFAULT false,
  is_swapped BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_plans_user_id ON workout_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_plans_week_day ON workout_plans(user_id, week_number, day_of_week);
CREATE INDEX IF NOT EXISTS idx_workout_plans_plan_date ON workout_plans(user_id, plan_date);

