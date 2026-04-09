const RewardService = require("../services/reward.service");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { getValidatedDateRange } = require("../utils/dateRange");

class RewardController {
  // ─── Admin: Rule Management ───────────────────────────────────────────────

  static getAllRules = asyncHandler(async (req, res) => {
    const { start_date, end_date } = getValidatedDateRange(req.query || {});
    const data = await RewardService.getAllRules({ ...(req.query || {}), start_date, end_date });
    return successResponse(res, { message: "Reward rules fetched", data });
  });

  static getRuleById = asyncHandler(async (req, res) => {
    const rule = await RewardService.getRuleById(req.params.id);
    if (!rule) return errorResponse(res, "Rule not found", 404);
    return successResponse(res, { message: "Reward rule fetched", data: rule });
  });

  static createRule = asyncHandler(async (req, res) => {
    const { name, points_amount, price } = req.body;
    if (!name || (points_amount === undefined && !price)) {
      return errorResponse(res, "name and either points_amount or price are required", 400);
    }
    const rule = await RewardService.createRule(req.body);
    return successResponse(res, { message: "Reward/Pricing rule created", data: rule }, 201);
  });

  static updateRule = asyncHandler(async (req, res) => {
    const rule = await RewardService.updateRule(req.params.id, req.body);
    if (!rule) return errorResponse(res, "Rule not found", 404);
    return successResponse(res, { message: "Reward rule updated", data: rule });
  });

  static deleteRule = asyncHandler(async (req, res) => {
    const rule = await RewardService.deleteRule(req.params.id);
    if (!rule) return errorResponse(res, "Rule not found", 404);
    return successResponse(res, { message: "Reward rule deleted", data: rule });
  });

  // ─── User: Earn & Balance ─────────────────────────────────────────────────

  static earnPoints = asyncHandler(async (req, res) => {
    const { rule_id } = req.body;
    const userId = req.user.id;
    if (!rule_id) return errorResponse(res, "rule_id is required", 400);
    const result = await RewardService.earnPoints(userId, rule_id);
    return successResponse(res, { message: `You earned ${result.points} coins!`, data: result }, 201);
  });

  static getMyBalance = asyncHandler(async (req, res) => {
    const balance = await RewardService.getUserBalance(req.user.id);
    return successResponse(res, { message: "Balance fetched", data: balance });
  });

  static getMyEarningHistory = asyncHandler(async (req, res) => {
    const data = await RewardService.getUserEarningHistory(req.user.id, req.query);
    return successResponse(res, { message: "Earning history fetched", data });
  });

  static getLeaderboard = asyncHandler(async (req, res) => {
    const { start_date, end_date } = getValidatedDateRange(req.query || {});
    const data = await RewardService.getLeaderboard({ ...(req.query || {}), start_date, end_date });
    return successResponse(res, { message: "Leaderboard fetched", data });
  });
}

module.exports = RewardController;
