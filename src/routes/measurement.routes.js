const express = require("express");
const router = express.Router();
const measurementController = require("../controllers/measurement.controller");
const { protect } = require("../middlewares/auth.middleware");

router.post("/", protect, measurementController.logMeasurement);
router.get("/history", protect, measurementController.getHistory);
router.get("/latest", protect, measurementController.getLatest);

module.exports = router;
