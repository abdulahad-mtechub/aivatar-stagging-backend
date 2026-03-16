const ReportService = require("../services/report.service");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");
const AppError = require("../utils/appError");

/**
 * GET /api/reports/daily
 */
exports.getDailyReport = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { date } = req.query;
  const report = await ReportService.getDailyReport(userId, date);
  
  return apiResponse(res, 200, "Daily report retrieved", report);
});

/**
 * GET /api/reports/weekly
 */
exports.getWeeklyReport = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const report = await ReportService.getWeeklyReport(userId);
  
  return apiResponse(res, 200, "Weekly report retrieved", report);
});

/**
 * GET /api/reports/prediction
 */
exports.getPrediction = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const prediction = await ReportService.getGoalPrediction(userId);
  
  return apiResponse(res, 200, "Goal prediction retrieved", prediction);
});
