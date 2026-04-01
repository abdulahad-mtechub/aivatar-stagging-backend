BEGIN;

-- 1) Extend `workouts` to hold user-specific plan slots
ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS workout_id INTEGER REFERENCES workouts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_slot_id INTEGER REFERENCES workouts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS week_number INTEGER,
  ADD COLUMN IF NOT EXISTS day_of_week INTEGER,
  ADD COLUMN IF NOT EXISTS plan_date DATE,
  ADD COLUMN IF NOT EXISTS slot_type VARCHAR(20) DEFAULT 'workout',
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS is_skipped BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_swapped BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS assigned_reason VARCHAR(50);

-- Enforce day_of_week range for plan slots (templates will keep it NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workouts_day_of_week_check'
  ) THEN
    ALTER TABLE workouts
      ADD CONSTRAINT workouts_day_of_week_check
      CHECK (day_of_week IS NULL OR (day_of_week BETWEEN 1 AND 7));
  END IF;
END $$;

-- 2) Add indexes for querying plan slots
CREATE INDEX IF NOT EXISTS idx_workouts_user_id_week_day
  ON workouts(user_id, week_number, day_of_week);
CREATE INDEX IF NOT EXISTS idx_workouts_user_id_status
  ON workouts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_workouts_user_id_plan_date
  ON workouts(user_id, plan_date);

-- 3) Migrate existing rows from workout_plans -> workouts (plan slots)
--    - Copy workout template fields (name/description/duration/etc) into the new plan-row.
--    - Preserve the status/is_skipped/is_swapped/slot_type/etc.
--    - Rebuild parent_slot_id relationships via an old_id -> new_id mapping.
DO $$
DECLARE
  r RECORD;
  new_id INTEGER;
BEGIN
  CREATE TEMP TABLE tmp_workout_plan_map (
    old_id INTEGER PRIMARY KEY,
    new_id INTEGER PRIMARY KEY
  ) ON COMMIT DROP;

  FOR r IN
    (SELECT *
     FROM workout_plans
     ORDER BY id)
  LOOP
    IF r.workout_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Insert plan-row into workouts by copying fields from the template workout.
    INSERT INTO workouts (
      user_id,
      workout_id,
      parent_slot_id,
      week_number,
      day_of_week,
      plan_date,
      slot_type,
      status,
      is_skipped,
      is_swapped,
      assigned_reason,
      name,
      description,
      duration_minutes,
      difficulty,
      workout_type,
      estimated_calories,
      thumbnail_url,
      created_at,
      updated_at
    )
    SELECT
      r.user_id,
      r.workout_id,
      NULL,
      r.week_number,
      r.day_of_week,
      r.plan_date,
      r.slot_type,
      r.status,
      r.is_skipped,
      r.is_swapped,
      r.assigned_reason,
      t.name,
      t.description,
      t.duration_minutes,
      t.difficulty,
      t.workout_type,
      t.estimated_calories,
      t.thumbnail_url,
      r.created_at,
      r.updated_at
    FROM workouts t
    WHERE t.id = r.workout_id
    LIMIT 1
    RETURNING id INTO new_id;

    IF new_id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO tmp_workout_plan_map(old_id, new_id) VALUES (r.id, new_id);
  END LOOP;

  -- Rebuild parent_slot_id mapping.
  UPDATE workouts w
  SET parent_slot_id = mp_parent.new_id
  FROM tmp_workout_plan_map mp_child
  JOIN workout_plans wp_old
    ON wp_old.id = mp_child.old_id
  LEFT JOIN tmp_workout_plan_map mp_parent
    ON mp_parent.old_id = wp_old.parent_slot_id
  WHERE w.id = mp_child.new_id;
END $$;

-- 4) Drop workout_plans (no longer used)
DROP TABLE IF EXISTS workout_plans;

COMMIT;

