const CoinPriceService = require("../services/coinPrice.service");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");
const AppError = require("../utils/appError");

class CoinPriceController {
  static upsert = asyncHandler(async (req, res) => {
    const result = await CoinPriceService.upsertSingleton(req.body || {});
    return apiResponse(
      res,
      result.created ? 201 : 200,
      result.created ? "Coin price created successfully" : "Coin price updated successfully",
      { coin_price: result.row }
    );
  });

  static getCurrent = asyncHandler(async (_req, res, next) => {
    const current = await CoinPriceService.getCurrent();
    if (!current) return next(new AppError("Coin price not found", 404));
    return apiResponse(res, 200, "Coin price retrieved successfully", { coin_price: current });
  });

  static update = asyncHandler(async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return next(new AppError("Invalid coin price id", 400));
    }
    const coinPrice = await CoinPriceService.update(id, req.body || {});
    if (!coinPrice) return next(new AppError("Coin price not found", 404));
    return apiResponse(res, 200, "Coin price updated successfully", { coin_price: coinPrice });
  });

  static remove = asyncHandler(async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return next(new AppError("Invalid coin price id", 400));
    }
    const deleted = await CoinPriceService.remove(id);
    if (!deleted) return next(new AppError("Coin price not found", 404));
    return apiResponse(res, 200, "Coin price deleted successfully", { coin_price: deleted });
  });
}

module.exports = CoinPriceController;
