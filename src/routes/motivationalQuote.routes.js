const express = require("express");
const router = express.Router();
const MotivationalQuoteController = require("../controllers/motivationalQuote.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");

// All routes require authentication and admin role
router.use(protect);
router.use(restrictTo("admin"));

router.post("/", MotivationalQuoteController.createQuote);
router.get("/", MotivationalQuoteController.getQuotes);
router.patch("/:id", MotivationalQuoteController.updateQuote);
router.delete("/:id", MotivationalQuoteController.deleteQuote);

module.exports = router;
