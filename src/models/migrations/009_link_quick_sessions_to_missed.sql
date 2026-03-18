-- Migration: Link quick sessions to missed plan slots
-- Created at: 2026-03-18

ALTER TABLE workout_plans
ADD COLUMN IF NOT EXISTS parent_slot_id INTEGER REFERENCES workout_plans(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assigned_reason VARCHAR(50); -- e.g. 'ai', 'missed_makeup', 'quick_session'

CREATE INDEX IF NOT EXISTS idx_workout_plans_parent_slot_id ON workout_plans(parent_slot_id);

