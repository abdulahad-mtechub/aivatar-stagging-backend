const MealService = require("../services/meal.service");
const UserService = require("../services/user.service");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");

function parsePositiveInt(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

/**
 * Resolve which user's meals are targeted (list / by category). Admins must pass ?user_id=
 */
async function resolveTargetUserIdForRead(req) {
  if (req.user.role === "admin") {
    const raw = req.query.user_id;
    if (raw == null || String(raw).trim() === "") {
      throw new AppError("user_id is required in query when listing meals as admin", 400);
    }
    const uid = parsePositiveInt(raw);
    if (!uid) throw new AppError("Invalid user_id", 400);
    const user = await UserService.findById(uid);
    if (!user) throw new AppError("User not found", 404);
    return uid;
  }
  return req.user.id;
}

/**
 * Admin must pass ?user_id=; user must exist and own the meal.
 */
async function assertAdminMealBelongsToUser(meal, queryUserIdRaw) {
  if (queryUserIdRaw == null || String(queryUserIdRaw).trim() === "") {
    throw new AppError("user_id is required in query when viewing a meal as admin", 400);
  }
  const uid = parsePositiveInt(queryUserIdRaw);
  if (!uid) throw new AppError("Invalid user_id", 400);
  const user = await UserService.findById(uid);
  if (!user) throw new AppError("User not found", 404);
  if (meal.user_id !== uid) {
    throw new AppError("This meal does not belong to the specified user", 403);
  }
}

/**
 * Resolve meal owner on create. Admins must pass body.user_id (target user). Regular users own their meal.
 */
async function resolveOwnerIdForCreate(req) {
  if (req.user.role === "admin") {
    const raw = req.body.user_id;
    if (raw == null || String(raw).trim() === "") {
      throw new AppError("user_id is required when creating a meal as admin", 400);
    }
    const uid = parsePositiveInt(raw);
    if (!uid) throw new AppError("Invalid user_id", 400);
    const user = await UserService.findById(uid);
    if (!user) throw new AppError("User not found", 404);
    return uid;
  }
  return req.user.id;
}

/**
 * Get all meals from the library
 */
exports.getMeals = asyncHandler(async (req, res, next) => {
  const targetUserId = await resolveTargetUserIdForRead(req);
  const result = await MealService.findAll(targetUserId, {
    page: req.query.page,
    limit: req.query.limit,
    q: req.query.q,
    sort_by: req.query.sort_by,
    sort_order: req.query.sort_order,
    not_pagination: req.query.not_pagination,
  });
  return apiResponse(res, 200, "Meals retrieved successfully", result);
});

/**
 * Get all meals grouped by category
 */
exports.getMealsGrouped = asyncHandler(async (req, res, next) => {
  const targetUserId = await resolveTargetUserIdForRead(req);
  const grouped = await MealService.findAllGrouped(targetUserId);
  return apiResponse(res, 200, "Meals retrieved successfully", grouped);
});

/**
 * Create a new meal (user: self only; admin: must send user_id for the target user)
 */
exports.createMeal = asyncHandler(async (req, res, next) => {
  const { title, energy } = req.body;

  if (!title || !energy) {
    return next(new AppError("Title and nutritional energy info are required", 400));
  }

  const ownerId = await resolveOwnerIdForCreate(req);
  const { user_id: _adminUserId, ...mealPayload } = req.body;

  try {
    const meal = await MealService.create(ownerId, mealPayload);
    return apiResponse(res, 201, "Meal created successfully", meal);
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

/**
 * Update a meal (owner or admin)
 */
exports.updateMeal = asyncHandler(async (req, res, next) => {
  const mealId = parsePositiveInt(req.params.id);
  if (!mealId) return next(new AppError("Invalid meal id", 400));

  const existing = await MealService.findById(mealId);
  if (!existing) return next(new AppError("Meal not found", 404));

  const isAdmin = req.user.role === "admin";
  if (!isAdmin && existing.user_id !== req.user.id) {
    return next(new AppError("You do not have permission to update this meal", 403));
  }

  if (isAdmin) {
    const raw = req.body.user_id;
    if (raw == null || String(raw).trim() === "") {
      return next(
        new AppError("user_id is required in body when updating a meal as admin", 400)
      );
    }
    const uid = parsePositiveInt(raw);
    if (!uid) return next(new AppError("Invalid user_id", 400));
    const targetUser = await UserService.findById(uid);
    if (!targetUser) return next(new AppError("User not found", 404));
    if (existing.user_id !== uid) {
      return next(
        new AppError("This meal does not belong to the specified user", 403)
      );
    }
  }

  const { user_id: _ignoreUserId, ...payload } = req.body;

  try {
    const meal = await MealService.update(mealId, payload);
    return apiResponse(res, 200, "Meal updated successfully", meal);
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

/**
 * Get single meal details
 */
exports.getMealDetails = asyncHandler(async (req, res, next) => {
  const meal = await MealService.findById(req.params.id);
  if (!meal) return next(new AppError("Meal not found", 404));
  const isAdmin = req.user.role === "admin";
  if (isAdmin) {
    await assertAdminMealBelongsToUser(meal, req.query.user_id);
  } else if (meal.user_id !== req.user.id) {
    return next(new AppError("You do not have permission to view this meal", 403));
  }
  return apiResponse(res, 200, "Meal retrieved successfully", meal);
});

/**
 * Get meals by category
 */
exports.getMealsByCategory = asyncHandler(async (req, res, next) => {
  const targetUserId = await resolveTargetUserIdForRead(req);
  const { category } = req.params;
  const meals = await MealService.findByCategory(targetUserId, category);
  return apiResponse(res, 200, "Meals retrieved successfully", meals);
});
