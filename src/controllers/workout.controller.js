const ExerciseService = require("../services/exercise.service");
const WorkoutService = require("../services/workout.service");
const WorkoutSessionService = require("../services/workoutSession.service");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Workout Controller - handles workout, exercise, and logging requests
 */
class WorkoutController {
  /**
   * Get all workout templates
   */
  static getAllWorkouts = asyncHandler(async (req, res) => {
    const workouts = await WorkoutService.findAll();
    return successResponse(res, {
      message: "Workouts fetched successfully",
      data: workouts,
    });
  });

  /**
   * Get workout detail with exercise guides
   */
  static getWorkoutById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const workout = await WorkoutService.findById(id);
    
    if (!workout) {
      return errorResponse(res, "Workout not found", 404);
    }

    return successResponse(res, {
      message: "Workout detail fetched successfully",
      data: workout,
    });
  });

  /**
   * Get specific exercise guide (Video, Audio, Text)
   */
  static getExerciseById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const exercise = await ExerciseService.findById(id);
    
    if (!exercise) {
      return errorResponse(res, "Exercise not found", 404);
    }

    return successResponse(res, {
      message: "Exercise guide fetched successfully",
      data: exercise,
    });
  });

  /**
   * Start a workout session
   */
  static startSession = asyncHandler(async (req, res) => {
    const { workout_id } = req.body;
    const userId = req.user.id;

    if (!workout_id) {
      return errorResponse(res, "Workout ID is required", 400);
    }

    const session = await WorkoutSessionService.startSession(userId, workout_id);

    return successResponse(res, {
      message: "Workout session started",
      data: session,
    }, 201);
  });

  /**
   * Log a completed set
   */
  static logSet = asyncHandler(async (req, res) => {
    const { session_id, exercise_id, set_number, reps, weight, reps_target, weight_target, rest_time } = req.body;

    if (!session_id || !exercise_id || !set_number) {
      return errorResponse(res, "Missing required log data", 400);
    }

    const log = await WorkoutSessionService.logSet(session_id, exercise_id, {
      set_number,
      reps,
      weight,
      reps_target,
      weight_target,
      rest_time
    });

    return successResponse(res, {
      message: "Set logged successfully",
      data: log,
    }, 201);
  });

  /**
   * Complete workout and get summary
   */
  static completeSession = asyncHandler(async (req, res) => {
    const { session_id } = req.body;

    if (!session_id) {
      return errorResponse(res, "Session ID is required", 400);
    }

    const summary = await WorkoutSessionService.completeSession(session_id);

    return successResponse(res, {
      message: "Workout completed successfully",
      data: summary,
    });
  });

  /**
   * Create a new exercise (AI-Driven from Frontend)
   */
  static createExercise = asyncHandler(async (req, res) => {
    const exercise = await ExerciseService.create(req.body);
    return successResponse(res, {
      message: "Exercise created successfully",
      data: exercise,
    }, 201);
  });

  /**
   * Create a new workout (AI-Driven from Frontend)
   */
  static createWorkout = asyncHandler(async (req, res) => {
    const workout = await WorkoutService.create(req.body);
    return successResponse(res, {
      message: "Workout created successfully",
      data: workout,
    }, 201);
  });
}

module.exports = WorkoutController;
