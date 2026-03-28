const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analytics.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");

// Entire /api/analytics/* tree: valid JWT + role admin only
router.use(protect);
router.use(restrictTo("admin"));

router.get("/users/timeseries", analyticsController.getUserRegistrationsTimeseries);
router.get("/users", analyticsController.getUserAnalytics);

module.exports = router;
