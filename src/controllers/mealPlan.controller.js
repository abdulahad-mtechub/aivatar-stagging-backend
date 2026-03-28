const MealPlanService = require("../services/mealPlan.service");
const UserService = require("../services/user.service");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");

function parsePositiveInt(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

/** Admin must pass ?user_id= for GET meal-plan routes. */
async function resolveMealPlanTargetUserIdFromQuery(req) {
  if (req.user.role === "admin") {
    const raw = req.query.user_id;
    if (raw == null || String(raw).trim() === "") {
      throw new AppError(
        "user_id is required in query when accessing meal plans as admin",
        400
      );
    }
    const uid = parsePositiveInt(raw);
    if (!uid) throw new AppError("Invalid user_id", 400);
    const user = await UserService.findById(uid);
    if (!user) throw new AppError("User not found", 404);
    return uid;
  }
  return req.user.id;
}

/** Admin must pass body.user_id for POST meal-plan routes. */
async function resolveMealPlanOwnerIdFromBody(req) {
  if (req.user.role === "admin") {
    const raw = req.body.user_id;
    if (raw == null || String(raw).trim() === "") {
      throw new AppError(
        "user_id is required in body when managing meal plans as admin",
        400
      );
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
 * Add a single meal slot
 * POST /api/meal-plans
 */
exports.addSlot = asyncHandler(async (req, res, next) => {
  const { meal_id, week_number, day_of_week, plan_date, slot_type } = req.body;

  if (!week_number || !day_of_week || !slot_type) {
    return next(new AppError("week_number, day_of_week, and slot_type are required", 400));
  }

  const ownerId = await resolveMealPlanOwnerIdFromBody(req);
  const { user_id: _uid, ...body } = req.body;
  const slot = await MealPlanService.addSlot(ownerId, body);
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

  const ownerId = await resolveMealPlanOwnerIdFromBody(req);
  const inserted = await MealPlanService.bulkInsert(ownerId, slots);
  return apiResponse(res, 201, `${inserted.length} meal slots added to plan`, inserted);
});

/**
 * Get plan by week
 * GET /api/meal-plans/week/:weekNumber?user_id= (admin)
 */
exports.getPlanByWeek = asyncHandler(async (req, res, next) => {
  const targetUserId = await resolveMealPlanTargetUserIdFromQuery(req);
  const slots = await MealPlanService.getByWeek(targetUserId, req.params.weekNumber);
  return apiResponse(res, 200, "Weekly plan retrieved successfully", slots);
});

/**
 * Get plan by day
 * GET /api/meal-plans/week/:weekNumber/day/:dayOfWeek?user_id= (admin)
 */
exports.getPlanByDay = asyncHandler(async (req, res, next) => {
  const targetUserId = await resolveMealPlanTargetUserIdFromQuery(req);
  const slots = await MealPlanService.getByDay(
    targetUserId,
    req.params.weekNumber,
    req.params.dayOfWeek
  );
  return apiResponse(res, 200, "Daily plan retrieved successfully", slots);
});

/**
 * Get plan by category (slot_type)
 * GET /api/meal-plans/category/:category?user_id= (admin)
 */
exports.getPlanByCategory = asyncHandler(async (req, res, next) => {
  const { category } = req.params;
  const validCategories = ["breakfast", "lunch", "dinner", "snack"];

  if (!validCategories.includes(category.toLowerCase())) {
    return next(new AppError(`Invalid category. Use: ${validCategories.join(", ")}`, 400));
  }

  const targetUserId = await resolveMealPlanTargetUserIdFromQuery(req);
  const slots = await MealPlanService.getByCategory(targetUserId, category.toLowerCase());
  return apiResponse(res, 200, `Plan for category '${category}' retrieved successfully`, slots);
});

/**
 * Update a slot
 * PATCH /api/meal-plans/:id  (admin: body.user_id required, must own slot)
 */
exports.updateSlot = asyncHandler(async (req, res, next) => {
  const slotId = parsePositiveInt(req.params.id);
  if (!slotId) return next(new AppError("Invalid slot id", 400));

  const existing = await MealPlanService.findSlotById(slotId);
  if (!existing) return next(new AppError("Slot not found", 404));

  const isAdmin = req.user.role === "admin";
  if (!isAdmin && existing.user_id !== req.user.id) {
    return next(new AppError("You do not have permission to update this slot", 403));
  }

  let targetUserId = req.user.id;
  if (isAdmin) {
    const raw = req.body.user_id;
    if (raw == null || String(raw).trim() === "") {
      return next(
        new AppError(
          "user_id is required in body when updating a meal plan slot as admin",
          400
        )
      );
    }
    const uid = parsePositiveInt(raw);
    if (!uid) return next(new AppError("Invalid user_id", 400));
    const user = await UserService.findById(uid);
    if (!user) return next(new AppError("User not found", 404));
    if (existing.user_id !== uid) {
      return next(new AppError("This slot does not belong to the specified user", 403));
    }
    targetUserId = uid;
  }

  const { user_id: _ignore, ...payload } = req.body;
  const slot = await MealPlanService.updateSlot(slotId, targetUserId, payload);
  if (!slot) return next(new AppError("Slot not found or not yours", 404));
  return apiResponse(res, 200, "Meal slot updated successfully", slot);
});
