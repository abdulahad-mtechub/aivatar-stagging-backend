const express = require("express");
const router = express.Router();
const mealPlanController = require("../controllers/mealPlan.controller");
const { protect } = require("../middlewares/auth.middleware");

// Add a single slot
router.post("/", protect, mealPlanController.addSlot);

// Bulk insert (AI-generated plan)
router.post("/bulk", protect, mealPlanController.bulkInsert);

// Get plan by week
router.get("/week/:weekNumber", protect, mealPlanController.getPlanByWeek);

// Get plan by specific day in a week
router.get("/week/:weekNumber/day/:dayOfWeek", protect, mealPlanController.getPlanByDay);

// Get plan by category (slot_type): breakfast, lunch, dinner, snack
router.get("/category/:category", protect, mealPlanController.getPlanByCategory);

// Update a slot (status, skip, swap, replace meal)
router.patch("/:id", protect, mealPlanController.updateSlot);

module.exports = router;
