const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");
const { protect } = require("../middlewares/auth.middleware");
const authMiddleware = protect;

// Public: broadcast in-app + push to all active app users
router.post("/broadcast-active", notificationController.broadcastToActiveUsers);

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
