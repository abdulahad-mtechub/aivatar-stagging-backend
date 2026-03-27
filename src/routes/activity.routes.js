const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const activityController = require("../controllers/activity.controller");

router.post("/record-activity-log", protect, activityController.recordActivity);
router.get("/get-activity-log-by-user-id", protect, activityController.getActivityLogsByUser);

module.exports = router;

