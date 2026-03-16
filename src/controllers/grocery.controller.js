const MealService = require("../services/meal.service");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");
const AppError = require("../utils/appError");

/**
 * GET /api/grocery
 * Get user's grocery list 
 */
exports.getGroceryList = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const groceryList = await MealService.getGroceryList(userId);
  
  return apiResponse(res, 200, "Grocery list retrieved successfully", groceryList);
});

/**
 * PATCH /api/grocery/:mealId/toggle-bought
 * Body: { isBought: boolean }
 */
exports.toggleBought = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { mealId } = req.params;
  const { isBought } = req.body;

  if (typeof isBought !== 'boolean') {
    return next(new AppError("isBought boolean is required", 400));
  }

  const updated = await MealService.toggleBoughtStatus(userId, mealId, isBought);
  
  if (!updated) {
    return next(new AppError("Meal not found in grocery list", 404));
  }

  return apiResponse(res, 200, "Bought status updated", updated);
});

/**
 * POST /api/grocery/mark-all-bought
 * Body: { mealIds: [1, 2, 3] }
 */
exports.markAllBought = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { mealIds } = req.body;

  if (!mealIds || !Array.isArray(mealIds)) {
    return next(new AppError("mealIds array is required", 400));
  }

  const updated = await MealService.updateBoughtStatus(userId, mealIds, true);
  
  return apiResponse(res, 200, "Items marked as bought", updated);
});

/**
 * DELETE /api/grocery/clear
 * Reset grocery status for all items
 */
exports.clearGrocery = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  await MealService.clearGroceryList(userId);
  
  return apiResponse(res, 200, "Grocery list cleared", null);
});
