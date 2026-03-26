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

/**
 * GET /api/notifications?tab=all|unread&limit=50&offset=0
 * In-app notifications list for UI (All/Unread tabs)
 */
exports.list = asyncHandler(async (req, res) => {
  const data = await NotificationService.list(req.user.id, {
    tab: req.query.tab || "all",
    limit: req.query.limit || 50,
    offset: req.query.offset || 0,
  });
  return apiResponse(res, 200, "Notifications retrieved successfully", { notifications: data });
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read
 */
exports.markRead = asyncHandler(async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return next(new AppError("Invalid notification id", 400));
  }

  const updated = await NotificationService.markRead(req.user.id, id);
  if (!updated) return next(new AppError("Notification not found", 404));

  return apiResponse(res, 200, "Notification marked as read", { notification: updated });
});

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read
 */
exports.markAllRead = asyncHandler(async (req, res) => {
  await NotificationService.markAllRead(req.user.id);
  return apiResponse(res, 200, "All notifications marked as read");
});

/**
 * POST /api/notifications/send
 * Frontend passes title/body, backend stores in-app + sends push to same user
 * Body: { type?, title, body, metadata?, send_push? }
 */
exports.send = asyncHandler(async (req, res, next) => {
  const { type, title, body, metadata, send_push } = req.body || {};

  if (!title || !body) {
    return next(new AppError("title and body are required", 400));
  }

  const row = await NotificationService.createCustomNotification(
    req.user.id,
    { type, title, body, metadata },
    { send_push: send_push !== false }
  );

  return apiResponse(res, 201, "Notification sent successfully", { notification: row });
});

/**
 * POST /api/notifications/broadcast-active (admin)
 * Body: { type?, title, body, metadata?, send_push? }
 * Creates in-app notification for all active users (non-deleted, non-blocked, role user) and sends push when token exists.
 */
exports.broadcastToActiveUsers = asyncHandler(async (req, res, next) => {
  const { type, title, body, metadata, send_push } = req.body || {};

  if (!title || !body) {
    return next(new AppError("title and body are required", 400));
  }

  const summary = await NotificationService.broadcastToActiveUsers(
    { type, title, body, metadata },
    { send_push: send_push !== false }
  );

  return apiResponse(res, 201, "Broadcast queued successfully", summary);
});
