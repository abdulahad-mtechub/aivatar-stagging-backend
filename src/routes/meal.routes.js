const express = require("express");
const router = express.Router();
const mealController = require("../controllers/meal.controller");
const { protect } = require("../middlewares/auth.middleware");

router.get("/", protect, mealController.getMeals);
router.get("/grouped", protect, mealController.getMealsGrouped);
router.get("/category/:category", protect, mealController.getMealsByCategory);
router.get("/:id", protect, mealController.getMealDetails);
router.post("/", protect, mealController.createMeal);
router.put("/:id", protect, mealController.updateMeal);

module.exports = router;
