const StreakService = require("../services/streak.service");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");

/**
 * POST /api/streaks
 * Record activity for today. Body: { rule_id: 3, activity_type: 'workout' }
 */
exports.createStreak = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { activity_type = "general", rule_id } = req.body;

  try {
    const result = await StreakService.createStreak(userId, activity_type, rule_id);
    return apiResponse(res, 201, "Activity recorded successfully", result);
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

/**
 * GET /api/streaks
 * Get all streak types for the user (with lazy evaluation).
 * Optional query: ?activity_type=workout
 */
exports.getStreaks = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { activity_type } = req.query;

  try {
    const result = await StreakService.getStreaks(userId, activity_type || null);
    return apiResponse(res, 200, "Streak information retrieved", result);
  } catch (error) {
    return next(new AppError(error.message, 500));
  }
});

/**
 * GET /api/streaks/summary
 * Dashboard summary — all streak types with zero-defaults for missing ones.
 */
exports.getStreakSummary = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  try {
    const result = await StreakService.getSummary(userId);
    return apiResponse(res, 200, "Streak summary retrieved", result);
  } catch (error) {
    return next(new AppError(error.message, 500));
  }
});

/**
 * POST /api/streaks/restore
 * Restore expired streaks. Body: { activity_type: 'workout' } (optional)
 */
exports.restoreStreaks = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { activity_type } = req.body;

  try {
    const result = await StreakService.restoreStreaks(userId, activity_type || null);
    return apiResponse(res, 200, "Streaks restored successfully", result);
  } catch (error) {
    return next(new AppError(error.message, 500));
  }
});
