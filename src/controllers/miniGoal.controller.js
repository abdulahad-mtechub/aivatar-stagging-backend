const MiniGoalService = require("../services/miniGoal.service");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { getValidatedDateRange } = require("../utils/dateRange");

class MiniGoalController {
  static createGoal = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { title } = req.body;

    if (!title) {
      return errorResponse(res, "Title is required", 400);
    }

    const goal = await MiniGoalService.create(userId, req.body);
    return successResponse(res, { message: "Mini goal created", data: goal }, 201);
  });

  static getGoals = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const goals = await MiniGoalService.listByUser(userId, {
      currentDayOnly: true,
      excludeSkipped: true,
    });
    return successResponse(res, { message: "Mini goals fetched", data: goals });
  });

  static updateStatus = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { status, rule_id } = req.body;

    if (!["completed", "skipped", "snoozed", "active"].includes(status)) {
      return errorResponse(res, "Invalid status", 400);
    }

    const goal = await MiniGoalService.updateStatus(userId, id, status, { rule_id });
    return successResponse(res, { message: `Mini goal marked as ${status}`, data: goal });
  });

  static deleteGoal = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const goal = await MiniGoalService.delete(userId, id);

    if (!goal) return errorResponse(res, "Mini goal not found", 404);
    return successResponse(res, { message: "Mini goal deleted" });
  });

  static getGoalsByUserId = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { start_date, end_date } = getValidatedDateRange(req.query || {});
    const goals = await MiniGoalService.listByUser(userId, {
      currentDayOnly: false,
      start_date,
      end_date,
    });
    return successResponse(res, { message: "User mini goals fetched", data: goals });
  });
}

module.exports = MiniGoalController;
