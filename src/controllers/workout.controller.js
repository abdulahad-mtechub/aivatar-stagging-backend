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
   * Workout Home (First screen)
   * Returns planned workout(s) + missed + recommendations in one payload
   * GET /api/workouts/home?week_number=1&day_of_week=2&plan_date=2026-03-19
   */
  static getWorkoutHome = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const data = await WorkoutService.getHome(userId, {
      week_number: req.query.week_number,
      day_of_week: req.query.day_of_week,
      plan_date: req.query.plan_date,
      include_all_workouts: req.query.include_all_workouts !== "false",
      all_workouts_limit: req.query.all_workouts_limit,
      missed_limit: req.query.missed_limit,
    });

    return successResponse(res, {
      message: "Workout home fetched successfully",
      data,
    });
  });

  /**
   * Get all workout templates
   */
  static getAllWorkouts = asyncHandler(async (req, res) => {
    const workouts = await WorkoutService.findAll({
      include_exercises: req.query.include_exercises !== "false",
      limit: req.query.limit || 50,
      offset: req.query.offset || 0,
    });
    return successResponse(res, {
      message: "Workouts fetched successfully",
      data: workouts,
    });
  });

  /**
   * Quick workouts list (e.g. <= 20 minutes)
   * GET /api/workouts/quick?max_duration_minutes=20&limit=20&offset=0
   */
  static getQuickWorkouts = asyncHandler(async (req, res) => {
    const data = await WorkoutService.findQuick({
      max_duration_minutes: req.query.max_duration_minutes || 20,
      limit: req.query.limit || 20,
      offset: req.query.offset || 0,
    });

    return successResponse(res, {
      message: "Quick workouts fetched successfully",
      data,
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
   * Get session details for workout details screen
   * GET /api/workouts/sessions/:id
   */
  static getSessionById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const sessionId = Number(id);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return errorResponse(res, "Invalid session id", 400);
    }

    const data = await WorkoutSessionService.getSessionDetail(sessionId, userId);
    if (!data) return errorResponse(res, "Session not found", 404);

    return successResponse(res, {
      message: "Workout session detail fetched successfully",
      data,
    });
  });

  /**
   * Previous session best set for an exercise (per user)
   * GET /api/workouts/exercises/:id/previous-session
   */
  static getExercisePreviousSession = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const exerciseId = Number(id);
    if (!Number.isInteger(exerciseId) || exerciseId <= 0) {
      return errorResponse(res, "Invalid exercise id", 400);
    }

    const data = await WorkoutSessionService.getExercisePreviousSession(exerciseId, userId);
    return successResponse(res, {
      message: "Previous session fetched successfully",
      data,
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
