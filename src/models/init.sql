user-- ==========================================
-- Reusable Backend Starter Database Schema
-- ==========================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  confirm_password VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  phone_number VARCHAR(20),
  profile_image TEXT,
  block_status BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  is_verified BOOLEAN DEFAULT false,
  otp VARCHAR(10),
  otp_expires_at TIMESTAMP,
  otp_purpose VARCHAR(32),
  password_reset_verified_at TIMESTAMP,
  fcm_token VARCHAR(255),
  fcm_device_type VARCHAR(50),
  fcm_device_id VARCHAR(255)
);

-- Backward-compatible columns for existing databases (password reset flow: verify-otp then change-password)
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_purpose VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_verified_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_device_type VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_device_id VARCHAR(255);

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

-- Goals reference table (used by profiles)
CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  plan_duration VARCHAR(100),
  goal_weight FLOAT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Backward-compatible columns for existing databases
ALTER TABLE goals ADD COLUMN IF NOT EXISTS plan_duration VARCHAR(100);
ALTER TABLE goals ADD COLUMN IF NOT EXISTS goal_weight FLOAT;

-- Create indexes for goals table
CREATE INDEX IF NOT EXISTS idx_goals_deleted_at ON goals(deleted_at);

-- Profiles table (1-to-1 with users)
CREATE TABLE IF NOT EXISTS profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_image TEXT,                          -- Cloudinary URL (frontend uploads, passes URL here)
  address TEXT,
  reminder TEXT,                               -- Reminder message or schedule for the user
  plan_key VARCHAR(100),                       -- Subscription / plan identifier
  goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,  -- FK to goals table
  mentor_gender VARCHAR(20),                   -- Preferred mentor gender (e.g. 'male', 'female', 'any')
  gender VARCHAR(20),                          -- User's own gender (e.g. 'male', 'female', 'non-binary')
  qa_list JSONB DEFAULT '[]'::jsonb,           -- Array of {question, answer} objects
  job_type VARCHAR(100),                       -- User's job type / occupation
  target_calories INTEGER DEFAULT 2000,
  target_protein FLOAT DEFAULT 150.0,
  target_carbs FLOAT DEFAULT 200.0,
  target_fats FLOAT DEFAULT 70.0,
  target_weight FLOAT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  CONSTRAINT uq_profiles_user_id UNIQUE (user_id)
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;

-- Create indexes for profiles table
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_goal_id ON profiles(goal_id);
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles(deleted_at);

-- Stripe transaction + subscription tables
CREATE TABLE IF NOT EXISTS stripe_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT UNIQUE NOT NULL,
  plan_key VARCHAR(100) NOT NULL,
  stripe_customer_id TEXT,
  stripe_payment_intent_id TEXT,
  amount_total BIGINT,
  currency VARCHAR(10),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_transactions_user_id ON stripe_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_transactions_plan_key ON stripe_transactions(plan_key);

CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES stripe_transactions(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  plan_key VARCHAR(100) NOT NULL,
  status VARCHAR(50),
  current_period_end TIMESTAMP,
  cancel_reason TEXT,
  cancel_requested_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_stripe_subscriptions_transaction UNIQUE (transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_plan_key ON stripe_subscriptions(plan_key);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_status ON stripe_subscriptions(status);
ALTER TABLE stripe_subscriptions ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE stripe_subscriptions ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMP;

-- Content Management table (Privacy Policy, Terms & Conditions, etc.)
CREATE TABLE IF NOT EXISTS contentmanagement (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) UNIQUE NOT NULL, -- 'privacy_policy', 'terms_conditions'
  content TEXT NOT NULL,
  status BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for contentmanagement table
CREATE INDEX IF NOT EXISTS idx_contentmanagement_type ON contentmanagement(type);
CREATE INDEX IF NOT EXISTS idx_contentmanagement_status ON contentmanagement(status);


-- ==========================================
-- Meal Management System (Hierarchical)
-- ==========================================

-- 1. Energy (Nutrients)
CREATE TABLE IF NOT EXISTS meal_energy (
  id SERIAL PRIMARY KEY,
  calories INTEGER DEFAULT 0,
  protein FLOAT DEFAULT 0.0,
  carbs FLOAT DEFAULT 0.0,
  fats FLOAT DEFAULT 0.0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Meals Library
CREATE TABLE IF NOT EXISTS meals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  energy_id INTEGER REFERENCES meal_energy(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  preparation_time VARCHAR(50), -- e.g. '15 min'
  complexity VARCHAR(50),      -- e.g. 'Easy', 'Medium', 'Hard'
  image_url TEXT,
  category VARCHAR(50),         -- e.g. 'Breakfast', 'Lunch'
  quantity VARCHAR(100),         -- e.g. '2 x 500g'
  is_in_grocery BOOLEAN DEFAULT false,
  is_bought BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Flat Meal Plans Table
-- Each row = one meal slot for a user on a specific week/day
CREATE TABLE IF NOT EXISTS meal_plans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_id INTEGER REFERENCES meals(id) ON DELETE SET NULL,
  week_number INTEGER NOT NULL DEFAULT 1,  -- e.g. 1, 2, 3, 4
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Mon, 7=Sun
  plan_date DATE,                           -- Optional: specific calendar date
  slot_type VARCHAR(20) NOT NULL,           -- 'breakfast', 'lunch', 'dinner', 'snack'
  status VARCHAR(20) DEFAULT 'pending',     -- 'pending', 'completed', 'skipped'
  is_skipped BOOLEAN DEFAULT false,
  is_swapped BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_id ON meal_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_week_day ON meal_plans(user_id, week_number, day_of_week);

-- Backward-compatible cleanup: remove duplicate meal slots before unique index creation.
-- Keep the newest row (created_at desc, id desc) per (user_id, week_number, day_of_week, slot_type).
WITH ranked_meal_plans AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, week_number, day_of_week, LOWER(TRIM(slot_type))
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM meal_plans
)
DELETE FROM meal_plans
WHERE id IN (
  SELECT id
  FROM ranked_meal_plans
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_meal_plans_user_week_day_slot
  ON meal_plans(user_id, week_number, day_of_week, LOWER(TRIM(slot_type)));


-- ==========================================
-- Contact Us Module
-- ==========================================

CREATE TABLE IF NOT EXISTS contact_us (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  query TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Create indexes for contact_us table
CREATE INDEX IF NOT EXISTS idx_contact_us_email ON contact_us(email);
CREATE INDEX IF NOT EXISTS idx_contact_us_deleted_at ON contact_us(deleted_at);


-- ==========================================
-- Workout Module
-- ==========================================

-- 1. Exercises Library
CREATE TABLE IF NOT EXISTS exercises (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  audio_url TEXT,
  instructions JSONB DEFAULT '{}'::jsonb,
  category VARCHAR(50),
  target_muscle_group VARCHAR(100),
  duration_seconds INTEGER,
  difficulty VARCHAR(50),
  is_premium BOOLEAN DEFAULT false,
  default_rest_time_seconds INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Backward-compatible cleanup for existing DBs
ALTER TABLE exercises DROP COLUMN IF EXISTS media_url;
ALTER TABLE exercises DROP COLUMN IF EXISTS equipment;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;

-- 2. Workout Templates
CREATE TABLE IF NOT EXISTS workouts (
  id SERIAL PRIMARY KEY,
  -- When NULL, this row is a workout template (shared by all users).
  -- When NOT NULL, this row represents a user-specific planned slot.
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

  -- For planned slots, this points to the template workout id.
  -- For templates, this stays NULL.

  -- For planned slots only (e.g., reschedules/quick sessions).
  parent_slot_id INTEGER REFERENCES workouts(id) ON DELETE SET NULL,
  week_number INTEGER,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7),
  plan_date DATE,

  status VARCHAR(20) DEFAULT 'pending',
  is_skipped BOOLEAN DEFAULT false,
  is_swapped BOOLEAN DEFAULT false,
  assigned_reason VARCHAR(50),

  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  difficulty VARCHAR(50),
  workout_type VARCHAR(50),
  estimated_calories INTEGER,
  thumbnail_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Backward-compatible columns for existing databases where `workouts`
-- table already existed before user-linked scheduling fields were added.
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS parent_slot_id INTEGER REFERENCES workouts(id) ON DELETE SET NULL;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS week_number INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS day_of_week INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS plan_date DATE;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS is_skipped BOOLEAN DEFAULT false;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS is_swapped BOOLEAN DEFAULT false;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS assigned_reason VARCHAR(50);
ALTER TABLE workouts DROP COLUMN IF EXISTS slot_type;

-- 3. Workout Exercises (Junction Table)
CREATE TABLE IF NOT EXISTS workout_exercises (
  id SERIAL PRIMARY KEY,
  workout_id INTEGER REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id INTEGER REFERENCES exercises(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL,
  target_sets JSONB DEFAULT '[]'::jsonb,
  rest_time_seconds INTEGER,
  exercise_duration_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Backward-compatible cleanup for existing DBs
ALTER TABLE workout_exercises DROP COLUMN IF EXISTS default_sets;
ALTER TABLE workout_exercises DROP COLUMN IF EXISTS default_reps;
ALTER TABLE workout_exercises DROP COLUMN IF EXISTS default_weight;

-- 4. User Workout Sessions (Logging)
CREATE TABLE IF NOT EXISTS user_workout_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  workout_id INTEGER REFERENCES workouts(id) ON DELETE SET NULL,
  start_time TIMESTAMP DEFAULT NOW(),
  end_time TIMESTAMP,
  session_notes TEXT,
  status VARCHAR(20) DEFAULT 'active',
  total_volume FLOAT DEFAULT 0,
  calories_burned INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE user_workout_sessions ADD COLUMN IF NOT EXISTS session_notes TEXT;

-- 5. Workout Sets (Detailed Logs)
CREATE TABLE IF NOT EXISTS workout_sets (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES user_workout_sessions(id) ON DELETE CASCADE,
  exercise_id INTEGER REFERENCES exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  target_reps INTEGER,
  target_weight FLOAT,
  actual_reps INTEGER,
  actual_weight FLOAT,
  rest_time_seconds INTEGER,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for workout tables
CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category);
CREATE INDEX IF NOT EXISTS idx_exercises_is_premium ON exercises(is_premium);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout_id ON workout_exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_user_workout_sessions_user_id ON user_workout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_session_id ON workout_sets(session_id);

-- User-specific workout plan slots live inside `workouts`
CREATE INDEX IF NOT EXISTS idx_workouts_user_id_week_day ON workouts(user_id, week_number, day_of_week);
CREATE INDEX IF NOT EXISTS idx_workouts_user_id_status ON workouts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_workouts_user_id_plan_date ON workouts(user_id, plan_date);

-- ==========================================
-- Reminder Settings + In-app Notifications
-- ==========================================

CREATE TABLE IF NOT EXISTS reminder_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminder_type VARCHAR(50) NOT NULL,
  reminder_time TIME NOT NULL,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7),
  is_enabled BOOLEAN DEFAULT true,
  do_not_disturb_enabled BOOLEAN DEFAULT false,
  timezone VARCHAR(100),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for reminder tables
CREATE INDEX IF NOT EXISTS idx_reminder_settings_user_type ON reminder_settings(user_id, reminder_type);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- 6. User Physical Measurements
CREATE TABLE IF NOT EXISTS user_measurements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight FLOAT,
  waist FLOAT,
  chest FLOAT,
  hips FLOAT,
  arm FLOAT,
  recorded_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_user_measurement_date UNIQUE (user_id, recorded_date)
);

CREATE INDEX IF NOT EXISTS idx_user_measurements_user_id ON user_measurements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_measurements_recorded_date ON user_measurements(recorded_date);


-- ==========================================
-- Coins, Rewards & Badge System
-- ==========================================

-- 1. Reward Management (Rule Engine)
CREATE TABLE IF NOT EXISTS reward_management (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  module_type VARCHAR(50),
  trigger_event VARCHAR(100),
  reward_type VARCHAR(50),
  points_amount INTEGER NOT NULL DEFAULT 10 CHECK (points_amount >= 10),
  price DECIMAL(10, 2),
  currency VARCHAR(10),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_management_name_normalized ON reward_management (LOWER(TRIM(name)));

-- 2. User Earned Reward Points (Earnings Log)
CREATE TABLE IF NOT EXISTS user_earned_reward_points (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id INTEGER NOT NULL REFERENCES reward_management(id) ON DELETE CASCADE,
  module_type VARCHAR(50),
  point_earned_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Redeem Coin History (Redemptions Log)
CREATE TABLE IF NOT EXISTS redeem_coin_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id INTEGER NOT NULL REFERENCES reward_management(id) ON DELETE CASCADE,
  module_type VARCHAR(50),
  point_redem_date TIMESTAMP DEFAULT NOW(),
  redeem_code VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Points Transaction (Consolidated Audit Log)
CREATE TABLE IF NOT EXISTS points_transaction (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('earned', 'redeemed')),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id INTEGER NOT NULL REFERENCES reward_management(id) ON DELETE CASCADE,
  points_amount INTEGER NOT NULL DEFAULT 0,
  module_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Badges Table
CREATE TABLE IF NOT EXISTS badges (
  id SERIAL PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  max_points INTEGER NOT NULL,
  badge_image TEXT,
  color VARCHAR(50),
  color_value VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. User Streaks Table
CREATE TABLE IF NOT EXISTS user_streaks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id INTEGER REFERENCES reward_management(id) ON DELETE SET NULL,
  activity_type VARCHAR(50) DEFAULT 'general', -- e.g. 'workout', 'meal', 'general'
  steak_added_date TIMESTAMP DEFAULT NOW(),
  is_streak INTEGER DEFAULT 1, -- 1 for active, 0 for expired
  is_restored BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for coins/badges/streaks tables
CREATE INDEX IF NOT EXISTS idx_user_earned_user_id ON user_earned_reward_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_earned_rule_id ON user_earned_reward_points(rule_id);
CREATE INDEX IF NOT EXISTS idx_redeem_user_id ON redeem_coin_history(user_id);
CREATE INDEX IF NOT EXISTS idx_points_tx_user_id ON points_transaction(user_id);
CREATE INDEX IF NOT EXISTS idx_points_tx_type ON points_transaction(type);
CREATE INDEX IF NOT EXISTS idx_badges_max_points ON badges(max_points);
CREATE UNIQUE INDEX IF NOT EXISTS uq_badges_title_normalized ON badges (LOWER(TRIM(title)));
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_is_streak ON user_streaks(is_streak);
CREATE INDEX IF NOT EXISTS idx_user_streaks_added_date ON user_streaks(steak_added_date);

-- ==========================================
-- User Activity Log
-- ==========================================

CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_key VARCHAR(100) NOT NULL,
  description TEXT,
  action_type VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action_type ON activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);

-- ==========================================
-- Demo videos (admin: all, users: active only)
-- ==========================================

CREATE TABLE IF NOT EXISTS demo_videos (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_videos_is_active ON demo_videos(is_active);
CREATE INDEX IF NOT EXISTS idx_demo_videos_created_at ON demo_videos(created_at DESC);

-- 031_mini_goals.sql
CREATE TABLE IF NOT EXISTS mini_goals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id INTEGER REFERENCES reward_management(id) ON DELETE SET NULL, 
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'skipped', 'snoozed')),
  type VARCHAR(50) DEFAULT 'custom',
  points_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE mini_goals ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE mini_goals ALTER COLUMN end_date DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mini_goals_user_id ON mini_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_mini_goals_rule_id ON mini_goals(rule_id);
CREATE INDEX IF NOT EXISTS idx_mini_goals_status ON mini_goals(status);

-- One mini goal title per user (case-insensitive, trimmed)
WITH ranked_mini_goals AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, LOWER(TRIM(title))
      ORDER BY id ASC
    ) AS rn
  FROM mini_goals
)
DELETE FROM mini_goals
WHERE id IN (
  SELECT id FROM ranked_mini_goals WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mini_goals_user_title_normalized
  ON mini_goals (user_id, LOWER(TRIM(title)));

-- 032_motivational_quotes.sql
CREATE TABLE IF NOT EXISTS motivational_quotes (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  author VARCHAR(255),
  frequency VARCHAR(20) DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'one-off')),
  day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Monday, 7=Sunday
  scheduled_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_motivational_quotes_frequency ON motivational_quotes(frequency);
CREATE INDEX IF NOT EXISTS idx_motivational_quotes_is_active ON motivational_quotes(is_active);
CREATE INDEX IF NOT EXISTS idx_motivational_quotes_scheduled_at ON motivational_quotes(scheduled_at);

-- 033_modify_reward_management.sql
-- Update reward_management
ALTER TABLE reward_management ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2);
ALTER TABLE reward_management ADD COLUMN IF NOT EXISTS currency VARCHAR(10);
ALTER TABLE reward_management DROP COLUMN IF EXISTS type;

-- 034_coin_prices.sql
CREATE TABLE IF NOT EXISTS coin_prices (
  id SERIAL PRIMARY KEY,
  coins INTEGER NOT NULL CHECK (coins > 0),
  coins_price DECIMAL(12, 2) NOT NULL CHECK (coins_price >= 0),
  currency VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_prices_created_at ON coin_prices(created_at DESC);

