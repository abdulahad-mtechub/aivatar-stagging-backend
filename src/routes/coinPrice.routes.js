const express = require("express");
const router = express.Router();
const CoinPriceController = require("../controllers/coinPrice.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");

// Read routes
router.get("/", CoinPriceController.getCurrent);

// Admin routes
router.post("/", protect, restrictTo("admin"), CoinPriceController.upsert);
router.patch("/:id", protect, restrictTo("admin"), CoinPriceController.update);
router.delete("/:id", protect, restrictTo("admin"), CoinPriceController.remove);

module.exports = router;
