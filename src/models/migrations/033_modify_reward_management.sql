-- 033_modify_reward_management.sql

-- 1. Add new columns to reward_management
ALTER TABLE reward_management ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2);
ALTER TABLE reward_management ADD COLUMN IF NOT EXISTS currency VARCHAR(10);

-- 2. Remove the 'type' column
ALTER TABLE reward_management DROP COLUMN IF NOT EXISTS type;
