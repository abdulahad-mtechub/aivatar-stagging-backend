const MealPlanService = require("../services/mealPlan.service");
const MealService = require("../services/meal.service");
const IngredientService = require("../services/ingredient.service");
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

// ============================================================
// Pre-measured Quantities (Meal Ingredients) CRUD
// ============================================================

/**
 * GET /api/ingredients/meal/:mealId
 * Get all pre-measured ingredients for a specific meal
 */
exports.getMealIngredients = asyncHandler(async (req, res, next) => {
  const { mealId } = req.params;
  const ingredients = await IngredientService.getByMeal(mealId);
  return apiResponse(res, 200, "Meal ingredients retrieved successfully", ingredients);
});

/**
 * POST /api/ingredients/meal/:mealId
 * Add a single ingredient to a meal
 * Body: { name, quantity, unit?, image_url?, calories?, protein?, carbs?, fats? }
 */
exports.addIngredient = asyncHandler(async (req, res, next) => {
  const { mealId } = req.params;
  const { name, quantity } = req.body;

  if (!name || !quantity) {
    return next(new AppError("name and quantity are required", 400));
  }

  const ingredient = await IngredientService.addToMeal(mealId, req.body);
  return apiResponse(res, 201, "Ingredient added successfully", ingredient);
});

/**
 * POST /api/ingredients/meal/:mealId/bulk
 * Bulk set ingredients for a meal (replaces all existing)
 * Body: { ingredients: [{ name, quantity, unit?, image_url?, calories?, protein?, carbs?, fats? }] }
 */
exports.bulkAddIngredients = asyncHandler(async (req, res, next) => {
  const { mealId } = req.params;
  const { ingredients } = req.body;

  if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
    return next(new AppError("ingredients array is required and must not be empty", 400));
  }

  // Validate each item has name and quantity
  for (const ing of ingredients) {
    if (!ing.name || !ing.quantity) {
      return next(new AppError("Each ingredient must have a name and quantity", 400));
    }
  }

  const result = await IngredientService.bulkAddToMeal(mealId, ingredients);
  return apiResponse(res, 201, `${result.length} ingredients set for meal`, result);
});

/**
 * PATCH /api/ingredients/meal/:mealId/:ingredientId
 * Update a single ingredient
 */
exports.updateIngredient = asyncHandler(async (req, res, next) => {
  const { mealId, ingredientId } = req.params;

  const updated = await IngredientService.update(ingredientId, mealId, req.body);
  if (!updated) {
    return next(new AppError("Ingredient not found or does not belong to this meal", 404));
  }
  return apiResponse(res, 200, "Ingredient updated successfully", updated);
});

/**
 * DELETE /api/ingredients/meal/:mealId/:ingredientId
 * Delete a single ingredient
 */
exports.deleteIngredient = asyncHandler(async (req, res, next) => {
  const { mealId, ingredientId } = req.params;

  const deleted = await IngredientService.delete(ingredientId, mealId);
  if (!deleted) {
    return next(new AppError("Ingredient not found or does not belong to this meal", 404));
  }
  return apiResponse(res, 200, "Ingredient deleted successfully", deleted);
});

/**
 * DELETE /api/ingredients/meal/:mealId
 * Delete ALL ingredients for a meal
 */
exports.deleteAllIngredients = asyncHandler(async (req, res, next) => {
  const { mealId } = req.params;
  const deleted = await IngredientService.deleteAllForMeal(mealId);
  return apiResponse(res, 200, `${deleted.length} ingredients deleted`, deleted);
});
