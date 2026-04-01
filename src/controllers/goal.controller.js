const GoalService = require("../services/goal.service");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");

// Public: list goals
exports.getGoals = asyncHandler(async (req, res) => {
  const result = await GoalService.listActive();
  return apiResponse(res, 200, "Goals retrieved successfully", result);
});

// Public: get goal by id
exports.getGoalById = asyncHandler(async (req, res, next) => {
  const goalId = Number(req.params.id);
  if (!Number.isInteger(goalId) || goalId <= 0) {
    return next(new AppError("Invalid goal id", 400));
  }

  const result = await GoalService.getActiveById(goalId);
  if (!result) {
    return next(new AppError("Goal not found", 404));
  }
  return apiResponse(res, 200, "Goal retrieved successfully", result);
});

// Admin: create goal
exports.createGoal = asyncHandler(async (req, res, next) => {
  const { title, description, plan_duration, goal_weight } = req.body || {};

  if (!title || !String(title).trim()) {
    return next(new AppError("Please provide goal title", 400));
  }

  const parsedWeight =
    goal_weight === undefined || goal_weight === null || goal_weight === ""
      ? null
      : Number(goal_weight);
  if (parsedWeight !== null && !Number.isFinite(parsedWeight)) {
    return next(new AppError("goal_weight must be a valid number", 400));
  }

  const result = await GoalService.create({
    title: String(title).trim(),
    description: description ?? null,
    plan_duration: plan_duration ? String(plan_duration).trim() : null,
    goal_weight: parsedWeight,
  });

  return apiResponse(res, 201, "Goal created successfully", result);
});

// Admin: update goal
exports.updateGoal = asyncHandler(async (req, res, next) => {
  const goalId = Number(req.params.id);
  if (!Number.isInteger(goalId) || goalId <= 0) {
    return next(new AppError("Invalid goal id", 400));
  }

  const { title, description, plan_duration, goal_weight } = req.body || {};
  if (
    title === undefined &&
    description === undefined &&
    plan_duration === undefined &&
    goal_weight === undefined
  ) {
    return next(
      new AppError(
        "Please provide at least one field: title, description, plan_duration, goal_weight",
        400
      )
    );
  }

  const parsedWeight =
    goal_weight === undefined || goal_weight === null || goal_weight === ""
      ? goal_weight
      : Number(goal_weight);
  if (
    parsedWeight !== undefined &&
    parsedWeight !== null &&
    parsedWeight !== "" &&
    !Number.isFinite(parsedWeight)
  ) {
    return next(new AppError("goal_weight must be a valid number", 400));
  }

  const result = await GoalService.update(goalId, {
    title: title !== undefined ? String(title).trim() : undefined,
    description,
    plan_duration:
      plan_duration !== undefined
        ? plan_duration
          ? String(plan_duration).trim()
          : null
        : undefined,
    goal_weight:
      parsedWeight === ""
        ? null
        : parsedWeight === undefined
        ? undefined
        : parsedWeight,
  });

  if (!result) {
    return next(new AppError("Goal not found", 404));
  }
  return apiResponse(res, 200, "Goal updated successfully", result);
});

// Admin: delete goal (soft delete)
exports.deleteGoal = asyncHandler(async (req, res, next) => {
  const goalId = Number(req.params.id);
  if (!Number.isInteger(goalId) || goalId <= 0) {
    return next(new AppError("Invalid goal id", 400));
  }

  const deleted = await GoalService.softDelete(goalId);
  if (!deleted) {
    return next(new AppError("Goal not found", 404));
  }
  return apiResponse(res, 200, "Goal deleted successfully");
});
