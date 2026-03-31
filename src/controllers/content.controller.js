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
    const result = await ContentService.upsert(type, content, status);
    return apiResponse(res, 201, "Content updated successfully", result);
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
    const result = await ContentService.findByType(type);

    if (!result) {
      return next(new AppError(`${type} not found or is currently inactive`, 404));
    }

    return apiResponse(res, 200, "Content retrieved successfully", result);
  } catch (error) {
    return next(new AppError(error.message, 500));
  }
});
