const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function seedWorkoutData() {
  try {
    console.log('--- Seeding Workout Module Data ---');

    // 1. Create Exercises
    const benchPress = await pool.query(`
      INSERT INTO exercises (title, description, media_url, audio_url, instructions, category, target_muscle_group)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        'Bench Press', 
        'A classic chest exercise.', 
        'https://example.com/bench_press.mp4', 
        'https://example.com/bench_press_audio.mp3', 
        JSON.stringify({ steps: ["Lie on back", "Grip bar", "Lower to chest", "Push up"] }),
        'Strength',
        'Chest'
      ]
    );
    const exerciseId = benchPress.rows[0].id;
    console.log(`✅ Exercise "Bench Press" created (ID: ${exerciseId})`);

    // 2. Create Workout Template
    const workout = await pool.query(`
      INSERT INTO workouts (name, duration_minutes, difficulty, thumbnail_url)
      VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Upper Body Workout', 45, 'Intermediate', 'https://example.com/upper_body.jpg']
    );
    const workoutId = workout.rows[0].id;
    console.log(`✅ Workout "Upper Body Workout" created (ID: ${workoutId})`);

    // 3. Link Exercise to Workout
    await pool.query(`
      INSERT INTO workout_exercises (workout_id, exercise_id, sequence_order, default_sets, default_reps)
      VALUES ($1, $2, $3, $4, $5)`,
      [workoutId, exerciseId, 1, 3, 10]
    );
    console.log(`✅ Exercise linked to Workout`);

    console.log('\n--- Seeding Completed Successfully ---');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedWorkoutData();
