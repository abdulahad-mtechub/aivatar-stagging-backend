-- 1) Point all FKs at the canonical rule (lowest id per LOWER(TRIM(name))).
-- 2) Delete duplicate rule rows.
-- 3) Enforce unique normalized name.
-- Run in one transaction.

BEGIN;

UPDATE user_earned_reward_points u
SET rule_id = k.keeper_id
FROM (
  SELECT r.id AS rule_id,
    (SELECT MIN(r2.id) FROM reward_management r2
     WHERE LOWER(TRIM(r2.name)) = LOWER(TRIM(r.name))) AS keeper_id
  FROM reward_management r
) k
WHERE u.rule_id = k.rule_id AND k.rule_id <> k.keeper_id;

UPDATE redeem_coin_history u
SET rule_id = k.keeper_id
FROM (
  SELECT r.id AS rule_id,
    (SELECT MIN(r2.id) FROM reward_management r2
     WHERE LOWER(TRIM(r2.name)) = LOWER(TRIM(r.name))) AS keeper_id
  FROM reward_management r
) k
WHERE u.rule_id = k.rule_id AND k.rule_id <> k.keeper_id;

UPDATE points_transaction u
SET rule_id = k.keeper_id
FROM (
  SELECT r.id AS rule_id,
    (SELECT MIN(r2.id) FROM reward_management r2
     WHERE LOWER(TRIM(r2.name)) = LOWER(TRIM(r.name))) AS keeper_id
  FROM reward_management r
) k
WHERE u.rule_id = k.rule_id AND k.rule_id <> k.keeper_id;

UPDATE user_streaks u
SET rule_id = k.keeper_id
FROM (
  SELECT r.id AS rule_id,
    (SELECT MIN(r2.id) FROM reward_management r2
     WHERE LOWER(TRIM(r2.name)) = LOWER(TRIM(r.name))) AS keeper_id
  FROM reward_management r
) k
WHERE u.rule_id IS NOT NULL AND u.rule_id = k.rule_id AND k.rule_id <> k.keeper_id;

DELETE FROM reward_management r
WHERE r.id NOT IN (
  SELECT MIN(id) FROM reward_management GROUP BY LOWER(TRIM(name))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_management_name_normalized ON reward_management (LOWER(TRIM(name)));

COMMIT;
