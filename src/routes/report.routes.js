const express = require("express");
const router = express.Router();
const reportController = require("../controllers/report.controller");
const { protect } = require("../middlewares/auth.middleware");

router.use(protect);

router.get("/daily", reportController.getDailyReport);
router.get("/weekly", reportController.getWeeklyReport);
router.get("/prediction", reportController.getPrediction);

module.exports = router;
