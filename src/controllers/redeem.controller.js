const RedeemService = require("../services/redeem.service");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");

/**
 * POST /api/redeem
 * Redeem coins using a reward rule
 */
exports.redeemCoins = asyncHandler(async (req, res, next) => {
  const { rule_id } = req.body;
  const userId = req.user.id;

  if (!rule_id) {
    return next(new AppError("rule_id is required", 400));
  }

  try {
    const result = await RedeemService.redeemCoins(userId, rule_id);
    return apiResponse(res, 201, "Coins redeemed successfully", result);
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

/**
 * GET /api/redeem
 * Get authenticated user's redemption history
 */
exports.getMyRedeemHistory = asyncHandler(async (req, res, next) => {
  try {
    const data = await RedeemService.getUserRedeemHistory(req.user.id, req.query);
    return apiResponse(res, 200, "Redeem history retrieved successfully", data);
  } catch (error) {
    return next(new AppError(error.message, 500));
  }
});
