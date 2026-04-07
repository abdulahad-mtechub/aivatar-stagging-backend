const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");
const authMiddleware = protect;
const adminMiddleware = restrictTo("admin");

// Public route to get static templates
router.get("/templates", notificationController.getTemplates);

// Admin: broadcast in-app + push to all active app users
router.post("/broadcast-active", authMiddleware, adminMiddleware, notificationController.broadcastToActiveUsers);

// Admin: same as broadcast-active but only for given user ids
router.post("/broadcast-selected", authMiddleware, adminMiddleware, notificationController.broadcastToSelectedUsers);

// Admin: get notifications sent by admin
router.get("/admin/sent", authMiddleware, adminMiddleware, notificationController.listSentByAdmin);

// In-app notifications list (All/Unread)
router.get("/", authMiddleware, notificationController.list);
// Static paths before /:id/read so "read-all" is not captured as an id
router.patch("/read-all", authMiddleware, notificationController.markAllRead);

// Create + send notification to current user (in-app + push)
router.post("/send", authMiddleware, notificationController.send);

router.patch("/update-token", authMiddleware, notificationController.updateToken);
router.post("/test-send", authMiddleware, notificationController.testSend);
router.patch("/:id/read", authMiddleware, notificationController.markRead);


module.exports = router;
