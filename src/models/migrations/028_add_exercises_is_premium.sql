-- Migration: Add is_premium field to exercises table
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;

-- Create index for performance when filtering by premium status
CREATE INDEX IF NOT EXISTS idx_exercises_is_premium ON exercises(is_premium);
