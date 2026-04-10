const BadgeService = require("../services/badge.service");
const RewardService = require("../services/reward.service");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { getValidatedDateRange } = require("../utils/dateRange");

class BadgeController {
  // ─── User Facing ──────────────────────────────────────────────────────────

  static getAllBadges = asyncHandler(async (req, res) => {
    const { start_date, end_date } = getValidatedDateRange(req.query || {});
    const result = await BadgeService.getAllBadges({
      page: req.query.page,
      limit: req.query.limit,
      q: req.query.q,
      sort_by: req.query.sort_by,
      sort_order: req.query.sort_order,
      not_pagination: req.query.not_pagination,
      start_date,
      end_date,
    });
    return successResponse(res, { message: "Badges fetched", data: result });
  });

  static getMyBadge = asyncHandler(async (req, res) => {
    const balance = await RewardService.getUserBalance(req.user.id);
    const badge = await BadgeService.getUserActiveBadge(balance.current_balance);
    return successResponse(res, {
      message: "Your active badge",
      data: { balance, badge: badge || null },
    });
  });

  // ─── Admin Facing ─────────────────────────────────────────────────────────

  static createBadge = asyncHandler(async (req, res) => {
    const { title, max_points } = req.body;
    if (!title || !max_points) {
      return errorResponse(res, "title and max_points are required", 400);
    }
    const badge = await BadgeService.createBadge(req.body);
    return successResponse(res, { message: "Badge created", data: badge }, 201);
  });

  static updateBadge = asyncHandler(async (req, res) => {
    const badge = await BadgeService.updateBadge(req.params.id, req.body);
    if (!badge) return errorResponse(res, "Badge not found", 404);
    return successResponse(res, { message: "Badge updated", data: badge });
  });

  static deleteBadge = asyncHandler(async (req, res) => {
    const badge = await BadgeService.deleteBadge(req.params.id);
    if (!badge) return errorResponse(res, "Badge not found", 404);
    return successResponse(res, { message: "Badge deleted", data: badge });
  });
}

module.exports = BadgeController;
