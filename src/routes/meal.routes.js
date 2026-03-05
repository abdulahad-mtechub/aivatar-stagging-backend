const express = require("express");
const router = express.Router();
const mealController = require("../controllers/meal.controller");
const { protect } = require("../middlewares/auth.middleware");

// All meal routes are protected to ensure user ownership
router.use(protect);

router.get("/", mealController.getMeals);
router.get("/:id", mealController.getMealDetails);
router.post("/", mealController.createMeal);

module.exports = router;
