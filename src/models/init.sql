-- ==========================================
-- Reusable Backend Starter Database Schema
-- ==========================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  phone_number VARCHAR(20),
  profile_image TEXT,
  block_status BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  is_verified BOOLEAN DEFAULT false,
  otp VARCHAR(10),
  otp_expires_at TIMESTAMP
);

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

-- Posts table (example CRUD resource)
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Create indexes for posts table
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_deleted_at ON posts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);

-- Goals reference table (used by profiles)
CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Create indexes for goals table
CREATE INDEX IF NOT EXISTS idx_goals_deleted_at ON goals(deleted_at);

-- Profiles table (1-to-1 with users)
CREATE TABLE IF NOT EXISTS profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_image TEXT,                          -- Cloudinary URL (frontend uploads, passes URL here)
  reminder TEXT,                               -- Reminder message or schedule for the user
  plan_key VARCHAR(100),                       -- Subscription / plan identifier
  goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,  -- FK to goals table
  mentor_gender VARCHAR(20),                   -- Preferred mentor gender (e.g. 'male', 'female', 'any')
  gender VARCHAR(20),                          -- User's own gender (e.g. 'male', 'female', 'non-binary')
  qa_list JSONB DEFAULT '[]'::jsonb,           -- Array of {question, answer} objects
  job_type VARCHAR(100),                       -- User's job type / occupation
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  CONSTRAINT uq_profiles_user_id UNIQUE (user_id)
);

-- Create indexes for profiles table
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_goal_id ON profiles(goal_id);
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles(deleted_at);

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
  media_url TEXT,
  audio_url TEXT,
  instructions JSONB DEFAULT '{}'::jsonb,
  category VARCHAR(50),
  target_muscle_group VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- 2. Workout Templates
CREATE TABLE IF NOT EXISTS workouts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  duration_minutes INTEGER,
  difficulty VARCHAR(50),
  thumbnail_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- 3. Workout Exercises (Junction Table)
CREATE TABLE IF NOT EXISTS workout_exercises (
  id SERIAL PRIMARY KEY,
  workout_id INTEGER REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id INTEGER REFERENCES exercises(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL,
  default_sets INTEGER DEFAULT 3,
  default_reps INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. User Workout Sessions (Logging)
CREATE TABLE IF NOT EXISTS user_workout_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  workout_id INTEGER REFERENCES workouts(id) ON DELETE SET NULL,
  start_time TIMESTAMP DEFAULT NOW(),
  end_time TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active',
  total_volume FLOAT DEFAULT 0,
  calories_burned INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

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
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout_id ON workout_exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_user_workout_sessions_user_id ON user_workout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_session_id ON workout_sets(session_id);


-- ==========================================
-- Initial Admin User (optional)
-- ==========================================


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
  type VARCHAR(50) DEFAULT 'generic',
  points_amount INTEGER NOT NULL DEFAULT 10 CHECK (points_amount >= 10),
  frequency_limit VARCHAR(50),
  events_per_day INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

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
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_is_streak ON user_streaks(is_streak);
CREATE INDEX IF NOT EXISTS idx_user_streaks_added_date ON user_streaks(steak_added_date);
