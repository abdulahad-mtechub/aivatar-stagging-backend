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
-- Initial Admin User (optional)
-- ==========================================

