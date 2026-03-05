const MealService = require("../services/meal.service");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");

/**
 * Get all meals from the library
 */
exports.getMeals = asyncHandler(async (req, res, next) => {
  const meals = await MealService.findAll(req.user.id);
  return apiResponse(res, 200, "Meals retrieved successfully", meals);
});

/**
 * Create a new meal (User/AI-driven)
 */
exports.createMeal = asyncHandler(async (req, res, next) => {
  const { title, image_url, category, preparation_time, complexity, energy } = req.body;

  if (!title || !energy) {
    return next(new AppError("Title and nutritional energy info are required", 400));
  }

  const meal = await MealService.create(req.user.id, req.body);
  return apiResponse(res, 201, "Meal created successfully", meal);
});

/**
 * Get single meal details
 */
exports.getMealDetails = asyncHandler(async (req, res, next) => {
  const meal = await MealService.findById(req.params.id);
  if (!meal) return next(new AppError("Meal not found", 404));
  return apiResponse(res, 200, "Meal retrieved successfully", meal);
});
