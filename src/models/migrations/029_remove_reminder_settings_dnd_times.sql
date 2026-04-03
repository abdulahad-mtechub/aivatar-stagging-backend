-- Migration: Remove dnd_start_time and dnd_end_time from reminder_settings
ALTER TABLE reminder_settings DROP COLUMN IF EXISTS dnd_start_time;
ALTER TABLE reminder_settings DROP COLUMN IF EXISTS dnd_end_time;
