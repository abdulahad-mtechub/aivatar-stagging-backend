const NotificationService = require("../services/notification.service");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");
const AppError = require("../utils/appError");

/**
 * PATCH /api/notifications/update-token
 * Update the current user's FCM token
 */
exports.updateToken = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { fcmToken } = req.body;

  if (!fcmToken) {
    return next(new AppError("FCM token is required", 400));
  }

  await NotificationService.updateFcmToken(userId, fcmToken);
  
  return apiResponse(res, 200, "FCM token updated successfully", { fcmToken });
});

/**
 * POST /api/notifications/test-send
 * Send a test notification to the current user
 */
exports.testSend = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { title, body } = req.body;

  const result = await NotificationService.sendToUser(
    userId, 
    title || "Test Notification", 
    body || "This is a test notification from Soulify!"
  );
  
  if (!result) {
    return next(new AppError("Failed to send notification. Ensure your token is registered.", 400));
  }

  return apiResponse(res, 200, "Test notification sent", result);
});
