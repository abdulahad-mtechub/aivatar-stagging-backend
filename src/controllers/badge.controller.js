const BadgeService = require("../services/badge.service");
const RewardService = require("../services/reward.service");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

class BadgeController {
  // ─── User Facing ──────────────────────────────────────────────────────────

  static getAllBadges = asyncHandler(async (req, res) => {
    const badges = await BadgeService.getAllBadges();
    return successResponse(res, { message: "Badges fetched", data: badges });
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
