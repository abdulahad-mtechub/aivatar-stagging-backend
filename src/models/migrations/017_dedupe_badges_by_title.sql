-- Remove duplicate badges: same LOWER(TRIM(title)) keeps the row with smallest id.
-- Then enforce unique normalized title (safe if 016 was never applied).

DELETE FROM badges b
USING (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM(title))
      ORDER BY id ASC
    ) AS rn
  FROM badges
) d
WHERE b.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_badges_title_normalized ON badges (LOWER(TRIM(title)));
