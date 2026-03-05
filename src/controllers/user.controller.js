const UserService = require("../services/user.service");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");
const { generatePagination } = require("../utils/pagination");

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

