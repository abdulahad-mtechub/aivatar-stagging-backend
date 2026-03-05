const express = require("express");
const router = express.Router();
const mealPlanController = require("../controllers/mealPlan.controller");
const { protect } = require("../middlewares/auth.middleware");

// All meal-plan routes require authentication
router.use(protect);

// Add a single slot
router.post("/", mealPlanController.addSlot);

// Bulk insert (AI-generated plan)
router.post("/bulk", mealPlanController.bulkInsert);

// Get plan by week
router.get("/week/:weekNumber", mealPlanController.getPlanByWeek);

// Get plan by specific day in a week
router.get("/week/:weekNumber/day/:dayOfWeek", mealPlanController.getPlanByDay);

// Get plan by category (slot_type): breakfast, lunch, dinner, snack
router.get("/category/:category", mealPlanController.getPlanByCategory);

// Update a slot (status, skip, swap, replace meal)
router.patch("/:id", mealPlanController.updateSlot);

module.exports = router;
