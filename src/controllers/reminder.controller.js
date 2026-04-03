const ReminderService = require("../services/reminder.service");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");
const AppError = require("../utils/appError");

/**
 * GET /api/reminders/me
 * Get current user's reminder settings and all scheduled reminders
 */
exports.getMyReminders = asyncHandler(async (req, res) => {
  const data = await ReminderService.getOrCreate(req.user.id);
  const alertsCount = ReminderService.calculateScheduledAlerts(data);
  return apiResponse(res, 200, "Reminder settings retrieved successfully", { 
    ...data,
    scheduled_alerts_count: alertsCount
  });
});

/**
 * PATCH /api/reminders/me
 * Update global settings and/or perform a bulk sync of reminders
 */
exports.updateMyReminders = asyncHandler(async (req, res, next) => {
  const { reminders } = req.body;

  if (reminders !== undefined && !Array.isArray(reminders)) {
    return next(new AppError("reminders must be an array", 400));
  }

  const updated = await ReminderService.update(req.user.id, req.body);
  const alertsCount = ReminderService.calculateScheduledAlerts(updated);

  return apiResponse(res, 200, "Reminder settings updated successfully", { 
    ...updated,
    scheduled_alerts_count: alertsCount
  });
});

/**
 * POST /api/reminders/
 * Create a single reminder
 */
exports.addReminder = asyncHandler(async (req, res, next) => {
  const { reminder_type, reminder_time } = req.body;
  if (!reminder_type || !reminder_time) {
    return next(new AppError("reminder_type and reminder_time are required", 400));
  }
  const reminder = await ReminderService.addReminder(req.user.id, req.body);
  return apiResponse(res, 201, "Reminder created successfully", reminder);
});

/**
 * POST /api/reminders/bulk
 * Create multiple reminders without deleting existing ones
 */
exports.bulkAddReminders = asyncHandler(async (req, res, next) => {
  const { reminders } = req.body;
  if (!Array.isArray(reminders)) {
    return next(new AppError("reminders must be an array", 400));
  }
  const added = await ReminderService.bulkAddReminders(req.user.id, reminders);
  return apiResponse(res, 201, "Bulk reminders created successfully", added);
});

/**
 * PATCH /api/reminders/:id
 * Update a single reminder by ID
 */
exports.updateReminder = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const updated = await ReminderService.updateReminder(req.user.id, id, req.body);
  if (!updated) return next(new AppError("Reminder not found", 404));
  return apiResponse(res, 200, "Reminder updated successfully", updated);
});

/**
 * DELETE /api/reminders/:id
 * Delete a single reminder by ID
 */
exports.deleteReminder = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const deleted = await ReminderService.deleteReminder(req.user.id, id);
  if (!deleted) return next(new AppError("Reminder not found", 404));
  return apiResponse(res, 200, "Reminder deleted successfully");
});
