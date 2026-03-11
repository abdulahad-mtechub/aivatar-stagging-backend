const StreakService = require("../services/streak.service");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");

/**
 * Controller for Streak operations
 */

/**
 * Record a new streak activity
 */
exports.createStreak = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  
  try {
    const result = await StreakService.createStreak(userId);
    return apiResponse(res, 201, "Activity recorded successfully", result);
  } catch (error) {
    return next(new AppError(error.message, 500));
  }
});

/**
 * Get current streak count (triggers lazy evaluation)
 */
exports.getStreaks = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  
  try {
    const result = await StreakService.getStreaks(userId);
    return apiResponse(res, 200, "Streak information retrieved", result);
  } catch (error) {
    return next(new AppError(error.message, 500));
  }
});

/**
 * Restore expired streaks
 */
exports.restoreStreaks = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  
  try {
    const result = await StreakService.restoreStreaks(userId);
    return apiResponse(res, 200, "Streaks restored successfully", result);
  } catch (error) {
    return next(new AppError(error.message, 500));
  }
});
