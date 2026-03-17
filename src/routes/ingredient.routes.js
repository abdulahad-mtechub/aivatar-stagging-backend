const express = require("express");
const router = express.Router();
const ingredientController = require("../controllers/ingredient.controller");
const { protect } = require("../middlewares/auth.middleware");

// Protect all ingredient routes
router.use(protect);

/**
 * @route   GET /api/ingredients
 * @desc    Get daily ingredients grouped by Week > Day > Slot
 */
router.get("/", ingredientController.getDailyIngredients);

/**
 * @route   POST /api/ingredients/add-to-grocery
 * @desc    Add selected meals to grocery list
 * @body    { mealIds: [1, 2, 3] }
 */
router.post("/add-to-grocery", ingredientController.addToGrocery);

// ============================================================
// Pre-measured Quantities (Meal Ingredients) CRUD
// ============================================================

/**
 * @route   GET /api/ingredients/meal/:mealId
 * @desc    Get all pre-measured ingredients for a meal
 */
router.get("/meal/:mealId", ingredientController.getMealIngredients);

/**
 * @route   POST /api/ingredients/meal/:mealId
 * @desc    Add a single ingredient to a meal
 * @body    { name, quantity, unit?, calories?, protein?, carbs?, fats? }
 */
router.post("/meal/:mealId", ingredientController.addIngredient);

/**
 * @route   POST /api/ingredients/meal/:mealId/bulk
 * @desc    Bulk set (replace all) ingredients for a meal
 * @body    { ingredients: [{ name, quantity, unit?, calories?, protein?, carbs?, fats? }] }
 */
router.post("/meal/:mealId/bulk", ingredientController.bulkAddIngredients);

/**
 * @route   PATCH /api/ingredients/meal/:mealId/:ingredientId
 * @desc    Update a single ingredient
 */
router.patch("/meal/:mealId/:ingredientId", ingredientController.updateIngredient);

/**
 * @route   DELETE /api/ingredients/meal/:mealId/:ingredientId
 * @desc    Delete a single ingredient
 */
router.delete("/meal/:mealId/:ingredientId", ingredientController.deleteIngredient);

/**
 * @route   DELETE /api/ingredients/meal/:mealId
 * @desc    Delete ALL ingredients for a meal
 */
router.delete("/meal/:mealId", ingredientController.deleteAllIngredients);

module.exports = router;
