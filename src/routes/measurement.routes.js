const express = require("express");
const router = express.Router();
const measurementController = require("../controllers/measurement.controller");
const { protect } = require("../middlewares/auth.middleware");

router.use(protect);

router.post("/", measurementController.logMeasurement);
router.get("/history", measurementController.getHistory);
router.get("/latest", measurementController.getLatest);

module.exports = router;
