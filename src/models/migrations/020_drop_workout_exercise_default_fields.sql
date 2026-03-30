BEGIN;

ALTER TABLE workout_exercises DROP COLUMN IF EXISTS default_sets;
ALTER TABLE workout_exercises DROP COLUMN IF EXISTS default_reps;
ALTER TABLE workout_exercises DROP COLUMN IF EXISTS default_weight;

COMMIT;

