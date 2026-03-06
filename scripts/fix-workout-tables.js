const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function runWorkoutFix() {
  try {
    console.log('--- Creating Workout Module Tables Manually ---');
    
    await pool.query(`
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
    `);
    console.log('✅ exercises');

    await pool.query(`
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
    `);
    console.log('✅ workouts');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS workout_exercises (
        id SERIAL PRIMARY KEY,
        workout_id INTEGER REFERENCES workouts(id) ON DELETE CASCADE,
        exercise_id INTEGER REFERENCES exercises(id) ON DELETE CASCADE,
        sequence_order INTEGER NOT NULL,
        default_sets INTEGER DEFAULT 3,
        default_reps INTEGER DEFAULT 10,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ workout_exercises');

    await pool.query(`
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
    `);
    console.log('✅ user_workout_sessions');

    await pool.query(`
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
    `);
    console.log('✅ workout_sets');

    console.log('--- Verification ---');
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('exercises', 'workouts', 'workout_exercises', 'user_workout_sessions', 'workout_sets');");
    console.log('Tables created:', res.rows.map(r => r.table_name).join(', '));

    process.exit(0);
  } catch (err) {
    console.error('❌ Fix failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runWorkoutFix();
