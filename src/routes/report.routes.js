const express = require("express");
const router = express.Router();
const reportController = require("../controllers/report.controller");
const { protect } = require("../middlewares/auth.middleware");

router.get("/daily", protect, reportController.getDailyReport);
router.get("/weekly", protect, reportController.getWeeklyReport);
router.get("/prediction", protect, reportController.getPrediction);

module.exports = router;
