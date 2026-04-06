const MotivationalQuoteService = require('../services/motivationalQuote.service');
const asyncHandler = require('../utils/asyncHandler');
const { apiResponse } = require('../utils/apiResponse');
const AppError = require('../utils/appError');

class MotivationalQuoteController {
  static createQuote = asyncHandler(async (req, res) => {
    const quote = await MotivationalQuoteService.create(req.body);
    return apiResponse(res, 201, "Motivational quote created successfully", { quote });
  });

  static getQuotes = asyncHandler(async (req, res) => {
    const quotes = await MotivationalQuoteService.list(req.query);
    return apiResponse(res, 200, "Motivational quotes retrieved successfully", { quotes });
  });

  static updateQuote = asyncHandler(async (req, res, next) => {
    const quote = await MotivationalQuoteService.update(req.params.id, req.body);
    if (!quote) return next(new AppError("Motivational quote not found", 404));
    return apiResponse(res, 200, "Motivational quote updated successfully", { quote });
  });

  static deleteQuote = asyncHandler(async (req, res, next) => {
    const quote = await MotivationalQuoteService.delete(req.params.id);
    if (!quote) return next(new AppError("Motivational quote not found", 404));
    return apiResponse(res, 200, "Motivational quote deleted successfully");
  });
}

module.exports = MotivationalQuoteController;
