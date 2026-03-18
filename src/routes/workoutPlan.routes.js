const express = require("express");
const router = express.Router();
const workoutPlanController = require("../controllers/workoutPlan.controller");
const { protect } = require("../middlewares/auth.middleware");

// All workout-plan routes require authentication
router.use(protect);

// Add a single slot
router.post("/", workoutPlanController.addSlot);

// Bulk insert (AI-generated plan)
router.post("/bulk", workoutPlanController.bulkInsert);

// Assign workout(s) to current user (AI suggestion)
router.post("/assign", workoutPlanController.assign);

// Get plan by week
router.get("/week/:weekNumber", workoutPlanController.getPlanByWeek);

// Get plan by specific day in a week
router.get("/week/:weekNumber/day/:dayOfWeek", workoutPlanController.getPlanByDay);

// Update a slot (status, skip, swap, replace workout)
router.patch("/:id", workoutPlanController.updateSlot);

// Missed workout screen actions
router.post("/:id/make-up-tomorrow", workoutPlanController.makeUpTomorrow);
router.post("/:id/rest-day", workoutPlanController.restDay);
router.post("/:id/quick-session", workoutPlanController.quickSession);

module.exports = router;

