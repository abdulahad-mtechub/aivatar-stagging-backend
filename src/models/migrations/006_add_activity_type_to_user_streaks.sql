-- Add activity_type to user_streaks table
ALTER TABLE user_streaks ADD COLUMN IF NOT EXISTS activity_type VARCHAR(50) DEFAULT 'general';
