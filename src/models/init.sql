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

-- ==========================================
-- Initial Admin User (optional)
-- Password: admin123 (change after first login)
-- ==========================================
-- INSERT INTO users (name, email, password, role) 
-- VALUES (
--   'Admin User',
--   'admin@example.com',
--   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqJ5q5q5q5', -- bcrypt hash of 'admin123'
--   'admin'
-- );

