const WorkoutPlanService = require("../services/workoutPlan.service");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");

/**
 * Workout Plans Controller
 * - AI can generate a plan and frontend bulk inserts it
 * - Status supports "missed" for the Figma flow
 */

exports.addSlot = asyncHandler(async (req, res, next) => {
  const { workout_id, week_number, day_of_week } = req.body;

  if (!week_number || !day_of_week) {
    return next(new AppError("week_number and day_of_week are required", 400));
  }

  const slot = await WorkoutPlanService.addSlot(req.user.id, {
    workout_id,
    week_number,
    day_of_week,
    plan_date: req.body.plan_date,
    slot_type: req.body.slot_type,
  });

  return apiResponse(res, 201, "Workout slot added to plan successfully", slot);
});

exports.bulkInsert = asyncHandler(async (req, res, next) => {
  const { slots } = req.body;

  if (!slots || !Array.isArray(slots) || slots.length === 0) {
    return next(new AppError("slots array is required", 400));
  }

  const inserted = await WorkoutPlanService.bulkInsert(req.user.id, slots);
  return apiResponse(res, 201, `${inserted.length} workout slots added to plan`, inserted);
});

exports.getPlanByWeek = asyncHandler(async (req, res) => {
  const result = await WorkoutPlanService.getByWeek(req.user.id, req.params.weekNumber);
  return apiResponse(res, 200, "Weekly workout plan retrieved successfully", result);
});

exports.getPlanByDay = asyncHandler(async (req, res) => {
  const result = await WorkoutPlanService.getByDay(
    req.user.id,
    req.params.weekNumber,
    req.params.dayOfWeek
  );
  return apiResponse(res, 200, "Daily workout plan retrieved successfully", result);
});

exports.updateSlot = asyncHandler(async (req, res, next) => {
  const validStatuses = ["pending", "completed", "missed", "skipped"];
  const { status } = req.body;

  if (status && !validStatuses.includes(String(status).toLowerCase())) {
    return next(
      new AppError(`Invalid status. Use: ${validStatuses.join(", ")}`, 400)
    );
  }

  const slot = await WorkoutPlanService.updateSlot(req.params.id, req.user.id, req.body);
  if (!slot) return next(new AppError("Slot not found or not yours", 404));

  return apiResponse(res, 200, "Workout plan slot updated successfully", slot);
});

/**
 * Assign workout(s) to a user (AI suggestion -> schedule)
 * POST /api/workout-plans/assign
 * Body:
 * {
 *   "slots": [{ "workout_id": 1, "week_number": 1, "day_of_week": 2, "plan_date": "2026-03-19" }]
 * }
 *
 * Note: assigns for the logged-in user (no user_id passed).
 */
exports.assign = asyncHandler(async (req, res, next) => {
  const { slots } = req.body;

  if (!slots || !Array.isArray(slots) || slots.length === 0) {
    return next(new AppError("slots array is required", 400));
  }

  // Reuse bulk insert logic; status remains pending by default.
  const inserted = await WorkoutPlanService.bulkInsert(req.user.id, slots);
  return apiResponse(res, 201, "Workout(s) assigned successfully", inserted);
});

/**
 * Make it up tomorrow (Missed workout screen)
 * POST /api/workout-plans/:id/make-up-tomorrow
 */
exports.makeUpTomorrow = asyncHandler(async (req, res, next) => {
  const slotId = Number(req.params.id);
  if (!Number.isInteger(slotId) || slotId <= 0) {
    return next(new AppError("Invalid slot id", 400));
  }

  const result = await WorkoutPlanService.makeUpTomorrow(slotId, req.user.id);
  if (!result) return next(new AppError("Slot not found or not yours", 404));

  return apiResponse(res, 201, "Workout rescheduled to tomorrow", result);
});

/**
 * Rest day (skip today)
 * POST /api/workout-plans/:id/rest-day
 */
exports.restDay = asyncHandler(async (req, res, next) => {
  const slotId = Number(req.params.id);
  if (!Number.isInteger(slotId) || slotId <= 0) {
    return next(new AppError("Invalid slot id", 400));
  }

  const slot = await WorkoutPlanService.restDay(slotId, req.user.id);
  if (!slot) return next(new AppError("Slot not found or not yours", 404));

  return apiResponse(res, 200, "Rest day set successfully", slot);
});

/**
 * Quick session related to a missed slot
 * POST /api/workout-plans/:id/quick-session
 * Body: { "workout_id": 5 }
 */
exports.quickSession = asyncHandler(async (req, res, next) => {
  const slotId = Number(req.params.id);
  if (!Number.isInteger(slotId) || slotId <= 0) {
    return next(new AppError("Invalid slot id", 400));
  }

  const workoutId = Number(req.body.workout_id);
  if (!Number.isInteger(workoutId) || workoutId <= 0) {
    return next(new AppError("workout_id is required", 400));
  }

  const result = await WorkoutPlanService.createQuickSessionForSlot(
    slotId,
    req.user.id,
    workoutId
  );
  if (!result) return next(new AppError("Slot not found or not yours", 404));

  return apiResponse(res, 201, "Quick session created successfully", result);
});

