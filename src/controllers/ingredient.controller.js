const MealPlanService = require("../services/mealPlan.service");
const MealService = require("../services/meal.service");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");
const AppError = require("../utils/appError");

/**
 * GET /api/ingredients?date=2023-12-01
 * Get ingredients grouped by Week > Day > Slot
 */
exports.getDailyIngredients = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { date } = req.query;

  // The service now returns a nested structure for all user's planned meals
  const ingredients = await MealPlanService.getDailyIngredients(userId, date);
  
  return apiResponse(res, 200, "Ingredients retrieved and grouped successfully", ingredients);
});

/**
 * POST /api/ingredients/add-to-grocery
 * Body: { mealIds: [1, 2, 3] }
 */
exports.addToGrocery = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { mealIds } = req.body;

  if (!mealIds || !Array.isArray(mealIds)) {
    return next(new AppError("mealIds array is required", 400));
  }

  const updated = await MealService.updateGroceryStatus(userId, mealIds, true);
  
  return apiResponse(res, 200, "Items added to grocery list", updated);
});
