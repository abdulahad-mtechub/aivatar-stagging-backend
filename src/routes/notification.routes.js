const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");
const { protect } = require("../middlewares/auth.middleware");

router.use(protect);

// In-app notifications list (All/Unread)
router.get("/", notificationController.list);
// Mark one as read
router.patch("/:id/read", notificationController.markRead);
// Mark all as read
router.patch("/read-all", notificationController.markAllRead);

// Create + send notification to current user (in-app + push)
router.post("/send", notificationController.send);

router.patch("/update-token", notificationController.updateToken);
router.post("/test-send", notificationController.testSend);

module.exports = router;
