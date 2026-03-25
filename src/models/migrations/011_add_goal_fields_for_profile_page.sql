-- Migration: Add goal fields for profile goal setup page
-- Purpose: Support plan duration and goal weight directly on goals table

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS plan_duration VARCHAR(100),
  ADD COLUMN IF NOT EXISTS goal_weight FLOAT;

-- Optional helper index for goal lookups used by profile goal upsert
CREATE INDEX IF NOT EXISTS idx_goals_title_plan_weight
  ON goals (LOWER(title), plan_duration, goal_weight)
  WHERE deleted_at IS NULL;
