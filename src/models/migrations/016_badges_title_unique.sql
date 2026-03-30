-- Unique badge titles (case-insensitive, trimmed). Matches app logic in BadgeService.
-- If this fails: you have two rows whose LOWER(TRIM(title)) matches — delete or rename one.
-- Safe to re-run (IF NOT EXISTS).

CREATE UNIQUE INDEX IF NOT EXISTS uq_badges_title_normalized ON badges (LOWER(TRIM(title)));
