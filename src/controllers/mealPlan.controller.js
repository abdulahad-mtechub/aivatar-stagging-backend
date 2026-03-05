const MealPlanService = require("../services/mealPlan.service");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");

/**
 * Add a single meal slot
 * POST /api/meal-plans
 */
exports.addSlot = asyncHandler(async (req, res, next) => {
  const { meal_id, week_number, day_of_week, plan_date, slot_type } = req.body;

  if (!week_number || !day_of_week || !slot_type) {
    return next(new AppError("week_number, day_of_week, and slot_type are required", 400));
  }

  const slot = await MealPlanService.addSlot(req.user.id, req.body);
  return apiResponse(res, 201, "Meal slot added to plan successfully", slot);
});

/**
 * Bulk insert AI-generated plan slots
 * POST /api/meal-plans/bulk
 */
exports.bulkInsert = asyncHandler(async (req, res, next) => {
  const { slots } = req.body;

  if (!slots || !Array.isArray(slots) || slots.length === 0) {
    return next(new AppError("slots array is required", 400));
  }

  const inserted = await MealPlanService.bulkInsert(req.user.id, slots);
  return apiResponse(res, 201, `${inserted.length} meal slots added to plan`, inserted);
});

/**
 * Get plan by week
 * GET /api/meal-plans/week/:weekNumber
 */
exports.getPlanByWeek = asyncHandler(async (req, res, next) => {
  const slots = await MealPlanService.getByWeek(req.user.id, req.params.weekNumber);
  return apiResponse(res, 200, "Weekly plan retrieved successfully", slots);
});

/**
 * Get plan by day
 * GET /api/meal-plans/week/:weekNumber/day/:dayOfWeek
 */
exports.getPlanByDay = asyncHandler(async (req, res, next) => {
  const slots = await MealPlanService.getByDay(
    req.user.id,
    req.params.weekNumber,
    req.params.dayOfWeek
  );
  return apiResponse(res, 200, "Daily plan retrieved successfully", slots);
});

/**
 * Get plan by category (slot_type): breakfast, lunch, dinner, snack
 * GET /api/meal-plans/category/:category
 */
exports.getPlanByCategory = asyncHandler(async (req, res, next) => {
  const { category } = req.params;
  const validCategories = ["breakfast", "lunch", "dinner", "snack"];

  if (!validCategories.includes(category.toLowerCase())) {
    return next(new AppError(`Invalid category. Use: ${validCategories.join(", ")}`, 400));
  }

  const slots = await MealPlanService.getByCategory(req.user.id, category.toLowerCase());
  return apiResponse(res, 200, `Plan for category '${category}' retrieved successfully`, slots);
});

/**
 * Update a slot (status, skip, swap, replace meal)
 * PATCH /api/meal-plans/:id
 */
exports.updateSlot = asyncHandler(async (req, res, next) => {
  const slot = await MealPlanService.updateSlot(req.params.id, req.user.id, req.body);
  if (!slot) return next(new AppError("Slot not found or not yours", 404));
  return apiResponse(res, 200, "Meal slot updated successfully", slot);
});
