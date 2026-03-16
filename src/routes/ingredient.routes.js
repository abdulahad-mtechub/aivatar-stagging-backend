const express = require("express");
const router = express.Router();
const ingredientController = require("../controllers/ingredient.controller");
const { protect } = require("../middlewares/auth.middleware");

// Protect all ingredient routes
router.use(protect);

/**
 * @route   GET /api/ingredients
 * @desc    Get daily ingredients for a specific date
 */
router.get("/", ingredientController.getDailyIngredients);

/**
 * @route   POST /api/ingredients/add-to-grocery
 * @desc    Add selected meals to grocery list
 */
router.post("/add-to-grocery", ingredientController.addToGrocery);

module.exports = router;
