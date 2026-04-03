const MiniGoalService = require("../services/miniGoal.service");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

class MiniGoalController {
  static createGoal = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { title, start_date, end_date } = req.body;

    if (!title || !start_date || !end_date) {
      return errorResponse(res, "Title, start_date, and end_date are required", 400);
    }

    const goal = await MiniGoalService.create(userId, req.body);
    return successResponse(res, { message: "Mini goal created", data: goal }, 201);
  });

  static getGoals = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const goals = await MiniGoalService.listByUser(userId);
    return successResponse(res, { message: "Mini goals fetched", data: goals });
  });

  static updateStatus = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    if (!["completed", "skipped", "snoozed", "active"].includes(status)) {
      return errorResponse(res, "Invalid status", 400);
    }

    const goal = await MiniGoalService.updateStatus(userId, id, status);
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
    const goals = await MiniGoalService.listByUser(userId);
    return successResponse(res, { message: "User mini goals fetched", data: goals });
  });
}

module.exports = MiniGoalController;
