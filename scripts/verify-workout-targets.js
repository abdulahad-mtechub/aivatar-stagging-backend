require("dotenv").config();
const WorkoutService = require("../src/services/workout.service");
const logger = require("../src/utils/logger");

async function verifyWorkoutTargets() {
  try {
    logger.info("🧪 Starting verification of workout targets...");

    const workoutData = {
      name: "Target Test Workout",
      duration_minutes: 30,
      difficulty: "Beginner",
      thumbnail_url: "https://example.com/test.jpg",
      exercises: [
        {
          id: 1, // Using existing Bench Press exercise
          sets: 3,
          reps: 10,
          weight: 40.5,
          target_sets: [
            { set_number: 1, target_reps: 5, target_weight: 80 },
            { set_number: 2, target_reps: 8, target_weight: 70 },
            { set_number: 3, target_reps: 10, target_weight: 60 }
          ]
        }
      ]
    };

    logger.info("📝 Creating workout with targets...");
    const createdWorkout = await WorkoutService.create(workoutData);
    const workoutId = createdWorkout.id;
    logger.info(`✅ Workout created with ID: ${workoutId}`);

    logger.info("🔍 Fetching workout details...");
    const fetchedWorkout = await WorkoutService.findById(workoutId);

    if (!fetchedWorkout) {
      throw new Error("Workout not found after creation");
    }

    const exercise = fetchedWorkout.exercises[0];
    logger.info("📊 Verifying fields...");
    
    console.log("-----------------------------------------");
    console.log(`Workout Name: ${fetchedWorkout.name}`);
    console.log(`Exercise Title: ${exercise.title}`);
    console.log(`Default Sets: ${exercise.default_sets}`);
    console.log(`Default Reps: ${exercise.default_reps}`);
    console.log(`Default Weight: ${exercise.default_weight}`);
    console.log(`Target Sets (per-set overrides):`, JSON.stringify(exercise.target_sets, null, 2));
    console.log("-----------------------------------------");

    if (exercise.default_weight === 40.5 && 
        exercise.target_sets.length === 3 && 
        exercise.target_sets[0].target_weight === 80) {
      logger.info("🎉 Verification SUCCESSFUL! All fields are correctly stored and retrieved.");
    } else {
      throw new Error("Verification failed: Data mismatch");
    }

    process.exit(0);
  } catch (error) {
    logger.error("❌ Verification failed:", error.message);
    process.exit(1);
  }
}

verifyWorkoutTargets();
