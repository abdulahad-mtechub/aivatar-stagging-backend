const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middlewares/auth.middleware");
const activityController = require("../controllers/activity.controller");

router.post("/record-activity-log", protect, activityController.recordActivity);
router.get("/get-activity-log-by-user-id", protect, activityController.getActivityLogsByUser);
router.get(
  "/admin/last-week-overall-logs",
  protect,
  restrictTo("admin"),
  activityController.getLastWeekOverallLogs
);

module.exports = router;

