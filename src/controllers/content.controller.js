const ContentService = require("../services/content.service");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");

/**
 * Create or update content (Admin Only)
 */
exports.upsertContent = asyncHandler(async (req, res, next) => {
  const { type, content, status } = req.body;

  if (!type || !content) {
    return next(new AppError("Please provide content type and actual content", 400));
  }

  try {
    const result = await ContentService.createVersion(type, content, status);
    return apiResponse(res, 201, "Content version created successfully", result);
  } catch (error) {
    return next(new AppError(error.message, 500));
  }
});

/**
 * Get content by type (Public)
 */
exports.getContentByType = asyncHandler(async (req, res, next) => {
  const { type } = req.params;

  try {
    const result = await ContentService.findActiveByType(type);

    if (!result) {
      return next(new AppError(`${type} not found or is currently inactive`, 404));
    }

    return apiResponse(res, 200, "Content retrieved successfully", result);
  } catch (error) {
    return next(new AppError(error.message, 500));
  }
});

/**
 * List all versions by content type (Admin)
 */
exports.getContentVersionsByType = asyncHandler(async (req, res, next) => {
  const { type } = req.params;

  try {
    const result = await ContentService.listVersionsByType(type);
    return apiResponse(res, 200, "Content versions retrieved successfully", { versions: result });
  } catch (error) {
    return next(new AppError(error.message, 500));
  }
});

/**
 * Activate a specific content version by id (Admin)
 */
exports.activateContentVersion = asyncHandler(async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return next(new AppError("Invalid content version id", 400));
  }

  try {
    const result = await ContentService.activateVersion(id);
    if (!result) {
      return next(new AppError("Content version not found", 404));
    }
    return apiResponse(res, 200, "Content version activated successfully", result);
  } catch (error) {
    return next(new AppError(error.message, 500));
  }
});
