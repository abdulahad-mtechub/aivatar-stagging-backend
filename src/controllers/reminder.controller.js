const ReminderService = require("../services/reminder.service");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");
const AppError = require("../utils/appError");

/**
 * GET /api/reminders/me
 * Get current user's reminder settings (auto-creates defaults)
 */
exports.getMyReminders = asyncHandler(async (req, res) => {
  const settings = await ReminderService.getOrCreate(req.user.id);
  return apiResponse(res, 200, "Reminder settings retrieved successfully", { settings });
});

/**
 * PATCH /api/reminders/me
 * Update current user's reminder settings
 */
exports.updateMyReminders = asyncHandler(async (req, res, next) => {
  // Basic validation for weekly day range if present
  if (
    req.body.weekly_weigh_in_day_of_week !== undefined &&
    req.body.weekly_weigh_in_day_of_week !== null
  ) {
    const day = Number(req.body.weekly_weigh_in_day_of_week);
    if (!Number.isInteger(day) || day < 1 || day > 7) {
      return next(new AppError("weekly_weigh_in_day_of_week must be between 1 and 7", 400));
    }
  }

  // meal_reminder_times should be an array of "HH:MM" strings
  if (req.body.meal_reminder_times !== undefined) {
    if (!Array.isArray(req.body.meal_reminder_times)) {
      return next(new AppError("meal_reminder_times must be an array (e.g. [\"08:00\",\"13:00\"])", 400));
    }
  }

  const updated = await ReminderService.update(req.user.id, req.body);
  if (!updated) return next(new AppError("No valid fields to update", 400));

  return apiResponse(res, 200, "Reminder settings updated successfully", { settings: updated });
});

