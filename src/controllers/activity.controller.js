const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const { apiResponse } = require("../utils/apiResponse");
const ActivityService = require("../services/activity.service");

exports.recordActivity = asyncHandler(async (req, res, next) => {
  const user_id = req.body.user_id ? Number(req.body.user_id) : req.user.id;
  const { module_key, description, action_type } = req.body || {};

  if (!user_id || !module_key || !action_type) {
    return next(new AppError("user_id, module_key and action_type are required", 400));
  }

  // Non-admin can only log for self
  if (req.user.role !== "admin" && Number(user_id) !== Number(req.user.id)) {
    return next(new AppError("You do not have permission to perform this action", 403));
  }

  const result = await ActivityService.recordActivity({
    user_id,
    module_key,
    description,
    action_type,
  });

  return apiResponse(res, 201, "Activity recorded successfully", result);
});

exports.getActivityLogsByUser = asyncHandler(async (req, res, next) => {
  const queryUserId = req.query.user_id ? Number(req.query.user_id) : req.user.id;
  const { action_type, sort_by = "DESC", page = 1, limit = 10 } = req.query;

  if (!queryUserId) {
    return next(new AppError("user_id is required", 400));
  }

  // Non-admin can only view own logs
  if (req.user.role !== "admin" && Number(queryUserId) !== Number(req.user.id)) {
    return next(new AppError("You do not have permission to perform this action", 403));
  }

  const result = await ActivityService.getActivityLogsByUser({
    user_id: queryUserId,
    action_type,
    sort_by,
    page,
    limit,
  });

  return apiResponse(res, 200, "Activity logs fetched successfully", result);
});

exports.getLastWeekOverallLogs = asyncHandler(async (req, res) => {
  const { action_type, sort_by = "DESC", page = 1, limit = 10 } = req.query;

  const result = await ActivityService.getLastWeekOverallLogs({
    action_type,
    sort_by,
    page,
    limit,
  });

  return apiResponse(res, 200, "Last week overall activity logs fetched successfully", result);
});

