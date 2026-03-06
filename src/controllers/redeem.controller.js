const RedeemService = require("../services/redeem.service");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

class RedeemController {
  static redeemCoins = asyncHandler(async (req, res) => {
    const { rule_id } = req.body;
    const userId = req.user.id;
    if (!rule_id) return errorResponse(res, "rule_id is required", 400);
    const result = await RedeemService.redeemCoins(userId, rule_id);
    return successResponse(res, {
      message: `Redeemed! Your code: ${result.redemption.redeem_code}`,
      data: result,
    }, 201);
  });

  static getMyRedeemHistory = asyncHandler(async (req, res) => {
    const data = await RedeemService.getUserRedeemHistory(req.user.id, req.query);
    return successResponse(res, { message: "Redeem history fetched", data });
  });
}

module.exports = RedeemController;
