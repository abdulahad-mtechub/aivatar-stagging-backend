BEGIN;

-- Keep one row per (user, week, day, slot_type), remove older duplicates first.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, week_number, day_of_week, LOWER(TRIM(slot_type))
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM meal_plans
)
DELETE FROM meal_plans mp
USING ranked r
WHERE mp.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_meal_plans_user_week_day_slot
  ON meal_plans(user_id, week_number, day_of_week, LOWER(TRIM(slot_type)));

COMMIT;
