const UserService = require("../services/user.service");
const ActivityService = require("../services/activity.service");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");

/**
 * Get all users with pagination
 */
exports.getAllUsers = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;

  const result = await UserService.findAll({ page, limit });

  return apiResponse(res, 200, "Resources retrieved successfully", {
    users: result.users,
    pagination: result.pagination,
  });
});

/**
 * Admin: Get all users with profile data (non-deleted)
 */
exports.getAllUsersWithProfile = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    status = "mixed",
    sort_by,
    sort_order,
    q,
    not_pagination,
  } = req.query;
  let result;
  try {
    result = await UserService.findAllWithProfiles({
      page,
      limit,
      status,
      sort_by,
      sort_order,
      q,
      not_pagination,
    });
  } catch (error) {
    return next(new AppError(error.message, 400));
  }

  return apiResponse(res, 200, "Resources retrieved successfully", {
    users: result.users,
    pagination: result.pagination,
  });
});

/**
 * Admin: Get deleted users with profile data
 */
exports.getDeletedUsersWithProfile = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10, sort_by, sort_order, q, not_pagination } = req.query;
  const result = await UserService.findDeletedWithProfiles({
    page,
    limit,
    sort_by,
    sort_order,
    q,
    not_pagination,
  });

  return apiResponse(res, 200, "Resources retrieved successfully", {
    users: result.users,
    pagination: result.pagination,
  });
});

/**
 * Admin: Full user detail by ID
 * Includes user + profile + subscription + reminders + goal + measurements.
 */
exports.getUserDetailById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return next(new AppError("Invalid id parameter", 400));
  }

  const data = await UserService.getAdminProgressMonitoring(userId);
  if (!data) {
    return next(new AppError("Resource not found", 404));
  }

  return apiResponse(res, 200, "Resource retrieved successfully", data);
});

/**
 * Admin: Get activity logs for specific user
 * GET /api/users/:id/activity-logs
 */
exports.getUserActivityLogs = asyncHandler(async (req, res, next) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return next(new AppError("Invalid id parameter", 400));
  }

  const user = await UserService.findAnyById(userId);
  if (!user) {
    return next(new AppError("Resource not found", 404));
  }

  const { action_type, sort_by = "DESC", page = 1, limit = 10 } = req.query;
  const result = await ActivityService.getActivityLogsByUser({
    user_id: userId,
    action_type,
    sort_by,
    page,
    limit,
  });

  return apiResponse(res, 200, "Activity logs fetched successfully", result);
});

/**
 * Get user by ID
 */
exports.getUserById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const user = await UserService.findById(id);

  if (!user) {
    return next(new AppError("Resource not found", 404));
  }

  // Remove password from response
  const { password, ...userWithoutPassword } = user;

  return apiResponse(res, 200, "Resource retrieved successfully", {
    user: userWithoutPassword,
  });
});

/**
 * Update user
 */
exports.updateUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const updateData = req.body;

  const updatedUser = await UserService.update(id, updateData);

  if (!updatedUser) {
    return next(new AppError("Resource not found", 404));
  }

  // Remove password from response
  const { password, ...userWithoutPassword } = updatedUser;

  return apiResponse(res, 200, "Resource updated successfully", {
    user: userWithoutPassword,
  });
});

/**
 * Admin: Set user account status (active/inactive)
 * PATCH /api/users/:id/account-status
 * Body: { status: "active" | "inactive" }
 */
exports.setUserAccountStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const rawStatus = req.body?.status;
  const status = String(rawStatus || "").toLowerCase().trim();

  if (status !== "active" && status !== "inactive") {
    return next(new AppError("status must be active or inactive", 400));
  }

  const updatedUser = await UserService.update(id, {
    block_status: status === "inactive",
  });

  if (!updatedUser) {
    return next(new AppError("Resource not found", 404));
  }

  const { password, ...userWithoutPassword } = updatedUser;
  return apiResponse(
    res,
    200,
    status === "inactive" ? "User marked inactive successfully" : "User marked active successfully",
    { user: userWithoutPassword }
  );
});

/**
 * Delete own account (soft delete)
 */
exports.deleteMe = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  await UserService.delete(userId);

  return apiResponse(res, 200, "Your account has been deleted successfully");
});

/**
 * Delete user (soft delete)
 */
exports.deleteUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  await UserService.delete(id);

  return apiResponse(res, 200, "Resource deleted successfully");
});

