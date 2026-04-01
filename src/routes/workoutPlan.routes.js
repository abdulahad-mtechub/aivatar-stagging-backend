const express = require("express");
const router = express.Router();
const workoutPlanController = require("../controllers/workoutPlan.controller");
const { protect } = require("../middlewares/auth.middleware");

// Add a single slot
router.post("/", protect, workoutPlanController.addSlot);

// Bulk insert (AI-generated plan)
router.post("/bulk", protect, workoutPlanController.bulkInsert);

// Assign workout(s) to current user (AI suggestion)
router.post("/assign", protect, workoutPlanController.assign);

// Get plan by week
router.get("/week/:weekNumber", protect, workoutPlanController.getPlanByWeek);

// Get plan by specific day in a week
router.get("/week/:weekNumber/day/:dayOfWeek", protect, workoutPlanController.getPlanByDay);

// Update a slot (status, skip, swap, replace workout)
router.patch("/:id", protect, workoutPlanController.updateSlot);

// Missed workout screen actions
router.post("/:id/make-up-tomorrow", protect, workoutPlanController.makeUpTomorrow);
router.post("/:id/rest-day", protect, workoutPlanController.restDay);
router.get("/:id/quick-session", protect, workoutPlanController.quickSession);

module.exports = router;

