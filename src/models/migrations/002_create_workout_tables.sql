-- Migration: Create Workout Module Tables
-- Created at: 2026-03-06

-- 1. Exercises Library
CREATE TABLE IF NOT EXISTS exercises (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  media_url TEXT, -- Video URL
  video_url TEXT,
  thumbnail_url TEXT,
  audio_url TEXT,
  instructions JSONB DEFAULT '{}'::jsonb, -- Detailed steps
  category VARCHAR(50),
  target_muscle_group VARCHAR(100),
  duration_seconds INTEGER,
  equipment VARCHAR(100),
  difficulty VARCHAR(50),
  default_rest_time_seconds INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- 2. Workout Templates
CREATE TABLE IF NOT EXISTS workouts (
  id SERIAL PRIMARY KEY,
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

-- 3. Workout Exercises (Junction Table)
CREATE TABLE IF NOT EXISTS workout_exercises (
  id SERIAL PRIMARY KEY,
  workout_id INTEGER REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id INTEGER REFERENCES exercises(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL,
  default_sets INTEGER DEFAULT 3,
  default_reps INTEGER DEFAULT 10,
  default_weight FLOAT DEFAULT 0.0,
  target_sets JSONB DEFAULT '[]'::jsonb,
  rest_time_seconds INTEGER,
  exercise_duration_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. User Workout Sessions (Logging)
CREATE TABLE IF NOT EXISTS user_workout_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  workout_id INTEGER REFERENCES workouts(id) ON DELETE SET NULL,
  start_time TIMESTAMP DEFAULT NOW(),
  end_time TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'cancelled'
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout_id ON workout_exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_user_workout_sessions_user_id ON user_workout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_session_id ON workout_sets(session_id);
