-- Add description column to meals table
ALTER TABLE meals ADD COLUMN IF NOT EXISTS description TEXT;
