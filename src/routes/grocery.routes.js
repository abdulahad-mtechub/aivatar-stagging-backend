const express = require("express");
const router = express.Router();
const groceryController = require("../controllers/grocery.controller");
const { protect } = require("../middlewares/auth.middleware");

/**
 * @route   GET /api/grocery
 * @desc    Get active grocery list
 */
router.get("/", protect, groceryController.getGroceryList);

/**
 * @route   PATCH /api/grocery/:mealId/toggle-bought
 * @desc    Toggle bought status of a meal item
 */
router.patch("/:mealId/toggle-bought", protect, groceryController.toggleBought);

/**
 * @route   POST /api/grocery/mark-all-bought
 * @desc    Mark multiple items as bought
 */
router.post("/mark-all-bought", protect, groceryController.markAllBought);

/**
 * @route   DELETE /api/grocery/clear
 * @desc    Clear the grocery list
 */
router.delete("/clear", protect, groceryController.clearGrocery);

module.exports = router;
