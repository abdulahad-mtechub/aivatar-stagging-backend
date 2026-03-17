-- Migration: Add Targets to Workout Exercises
-- Created at: 2026-03-17

ALTER TABLE workout_exercises 
ADD COLUMN IF NOT EXISTS default_weight FLOAT DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS target_sets JSONB DEFAULT '[]'::jsonb;

-- Update existing records if any (optional, but good for consistency)
-- UPDATE workout_exercises SET target_sets = '[]'::jsonb WHERE target_sets IS NULL;
