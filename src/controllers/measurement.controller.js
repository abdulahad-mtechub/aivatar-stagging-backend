const MeasurementService = require("../services/measurement.service");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");
const AppError = require("../utils/appError");

/**
 * POST /api/measurements
 * Log a new measurement
 */
exports.logMeasurement = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const measurement = await MeasurementService.logMeasurement(userId, req.body);
  
  return apiResponse(res, 201, "Measurement logged successfully", measurement);
});

/**
 * GET /api/measurements/history
 * Get measurement history
 */
exports.getHistory = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const history = await MeasurementService.getHistory(userId, req.query);
  
  return apiResponse(res, 200, "Measurement history retrieved", history);
});

/**
 * GET /api/measurements/latest
 */
exports.getLatest = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const latest = await MeasurementService.getLatest(userId);
  
  return apiResponse(res, 200, "Latest measurement retrieved", latest);
});
