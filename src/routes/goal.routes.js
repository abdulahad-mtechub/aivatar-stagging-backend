const express = require("express");
const router = express.Router();
const goalController = require("../controllers/goal.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");

// Public GET APIs
router.get("/", goalController.getGoals);
router.get("/:id", goalController.getGoalById);

// Admin CRUD APIs
router.post("/", protect, restrictTo("admin"), goalController.createGoal);
router.patch("/:id", protect, restrictTo("admin"), goalController.updateGoal);
router.delete("/:id", protect, restrictTo("admin"), goalController.deleteGoal);

module.exports = router;
