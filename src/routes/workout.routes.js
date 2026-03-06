const express = require("express");
const router = express.Router();
const WorkoutController = require("../controllers/workout.controller");
const { protect } = require("../middlewares/auth.middleware");

const asyncHandler = require("../utils/asyncHandler");
const ExerciseService = require("../services/exercise.service");
const { successResponse } = require("../utils/apiResponse");

// --- Exercise Content APIs ---
// Create Exercise (AI-Driven from Frontend)
router.post("/exercises", protect, WorkoutController.createExercise);
// Get list of exercises
router.get("/exercises", protect, asyncHandler(async (req, res) => {
  const result = await ExerciseService.findAll(req.query);
  return successResponse(res, { message: "Exercises fetched", data: result });
}));
// Get specific exercise guide
router.get("/exercises/:id", protect, WorkoutController.getExerciseById);

// --- Workout Template APIs ---
// Create Workout (AI-Driven from Frontend)
router.post("/", protect, WorkoutController.createWorkout);
// List workouts
router.get("/", protect, WorkoutController.getAllWorkouts);
// View workout details (Exercises list)
router.get("/:id", protect, WorkoutController.getWorkoutById);

// --- Workout Logging APIs ---
// Start session
router.post("/sessions/start", protect, WorkoutController.startSession);
// Log set
router.post("/sessions/log-set", protect, WorkoutController.logSet);
// Complete session
router.post("/sessions/complete", protect, WorkoutController.completeSession);

module.exports = router;
