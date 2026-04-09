const UserService = require("../services/user.service");
const ActivityService = require("../services/activity.service");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");
const bcrypt = require("bcryptjs");
const { getValidatedDateRange } = require("../utils/dateRange");

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
 * Admin: Create a user directly
 */
exports.createUser = asyncHandler(async (req, res, next) => {
  const { name, email, password, confirm_password, role = "user" } = req.body || {};

  if (!name || !email || !password || !confirm_password) {
    return next(new AppError("Please provide name, email, password and confirm_password", 400));
  }

  if (password !== confirm_password) {
    return next(new AppError("Passwords do not match", 400));
  }

  const normalizedRole = String(role || "user").toLowerCase().trim();
  if (normalizedRole !== "user" && normalizedRole !== "admin") {
    return next(new AppError("role must be user or admin", 400));
  }

  const existingUser = await UserService.findAnyByEmail(email);
  if (existingUser && !existingUser.deleted_at) {
    return next(new AppError("Email already in use", 409));
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const createdUser = await UserService.create({
    name,
    email,
    password: hashedPassword,
    confirm_password: hashedPassword,
    role: normalizedRole,
  });

  const verifiedUser = await UserService.verifyAfterOtp(createdUser.id, false);
  const user = verifiedUser || createdUser;
  const {
    password: _password,
    confirm_password: _confirmPassword,
    otp,
    otp_expires_at,
    otp_purpose,
    ...safeUser
  } = user;

  return apiResponse(res, 201, "User created successfully", { user: safeUser });
});

/**
 * Admin: Get all users with profile data (non-deleted)
 */
exports.getAllUsersWithProfile = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    status = "mixed",
    subscription = "mixed",
    sort_by,
    sort_order,
    q,
    not_pagination,
  } = req.query;
  let result;
  try {
    const { start_date, end_date } = getValidatedDateRange(req.query || {});
    result = await UserService.findAllWithProfiles({
      page,
      limit,
      status,
      subscription,
      sort_by,
      sort_order,
      q,
      not_pagination,
      start_date,
      end_date,
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
  const { start_date, end_date } = getValidatedDateRange(req.query || {});
  const result = await UserService.findDeletedWithProfiles({
    page,
    limit,
    sort_by,
    sort_order,
    q,
    not_pagination,
    start_date,
    end_date,
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
  const { start_date, end_date } = getValidatedDateRange(req.query || {});
  const result = await ActivityService.getActivityLogsByUser({
    user_id: userId,
    action_type,
    sort_by,
    page,
    limit,
    start_date,
    end_date,
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

/**
 * Hard delete user (permanent delete)
 */
exports.hardDeleteUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const deleted = await UserService.hardDelete(id);

  if (!deleted) {
    return next(new AppError("Resource not found", 404));
  }

  return apiResponse(res, 200, "User permanently deleted successfully");
});

/**
 * Admin: update user's profile by user id.
 * Upserts profile if missing.
 */
exports.updateUserProfileByAdmin = asyncHandler(async (req, res, next) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return next(new AppError("Invalid id parameter", 400));
  }

  const user = await UserService.findAnyById(userId);
  if (!user) {
    return next(new AppError("Resource not found", 404));
  }

  // Optional account-level update in the same endpoint
  if (
    req.body.name !== undefined ||
    req.body.email !== undefined ||
    req.body.phone_number !== undefined
  ) {
    const updatedUser = await UserService.update(userId, {
      name: req.body.name,
      email: req.body.email,
      phone_number: req.body.phone_number,
    });
    if (!updatedUser) {
      return next(new AppError("No valid user account fields to update", 400));
    }
  }

  let parsedQaList = undefined;
  if (req.body.qa_list !== undefined) {
    if (typeof req.body.qa_list === "string") {
      try {
        parsedQaList = JSON.parse(req.body.qa_list);
      } catch (err) {
        return next(new AppError("Invalid qa_list JSON", 400));
      }
    } else {
      parsedQaList = req.body.qa_list;
    }
  }

  const updatedProfile = await UserService.upsertUserProfileByUserId(userId, {
    profile_image: req.body.profile_image,
    address: req.body.address,
    reminder: req.body.reminder,
    plan_key: req.body.plan_key,
    goal_id: req.body.goal_id,
    mentor_gender: req.body.mentor_gender,
    gender: req.body.gender,
    qa_list: parsedQaList,
    job_type: req.body.job_type,
    target_weight: req.body.target_weight,
    target_calories: req.body.target_calories,
    target_protein: req.body.target_protein,
    target_carbs: req.body.target_carbs,
    target_fats: req.body.target_fats,
  });

  if (!updatedProfile) {
    return next(new AppError("No fields to update", 400));
  }

  return apiResponse(res, 200, "User profile updated successfully", {
    profile: updatedProfile,
  });
});

