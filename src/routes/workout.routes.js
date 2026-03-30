const express = require("express");
const router = express.Router();
const WorkoutController = require("../controllers/workout.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");

const asyncHandler = require("../utils/asyncHandler");
const ExerciseService = require("../services/exercise.service");
const { successResponse } = require("../utils/apiResponse");

// --- Exercise Content APIs ---
// Create Exercise (AI-Driven from Frontend)
router.post("/exercises", protect, restrictTo("admin"), WorkoutController.createExercise);
// Delete exercise (admin only)
router.delete("/exercises/:id", protect, restrictTo("admin"), WorkoutController.deleteExercise);
// Get list of exercises
router.get("/exercises", protect, asyncHandler(async (req, res) => {
  const result = await ExerciseService.findAll(req.query);
  return successResponse(res, { message: "Exercises fetched", data: result });
}));
// Get specific exercise guide
router.get("/exercises/:id", protect, WorkoutController.getExerciseById);
// Previous session best set for an exercise
router.get("/exercises/:id/previous-session", protect, WorkoutController.getExercisePreviousSession);

// --- Workout Template APIs ---
// Create Workout (AI-Driven from Frontend)
router.post("/", protect, WorkoutController.createWorkout);
// Workout Home (first page aggregated payload)
router.get("/home", protect, WorkoutController.getWorkoutHome);
// Quick workouts (<= max duration)
router.get("/quick", protect, WorkoutController.getQuickWorkouts);
// List workouts
router.get("/", protect, WorkoutController.getAllWorkouts);
// View workout details (Exercises list)
router.get("/:id", protect, WorkoutController.getWorkoutById);

// --- Workout Logging APIs ---
// Start session
router.post("/sessions/start", protect, WorkoutController.startSession);
// Get session detail (for workout details UI)
router.get("/sessions/:id", protect, WorkoutController.getSessionById);
// Log set
router.post("/sessions/log-set", protect, WorkoutController.logSet);
// Complete session
router.post("/sessions/complete", protect, WorkoutController.completeSession);

module.exports = router;
