const express = require("express");
const router = express.Router();
const MiniGoalController = require("../controllers/miniGoal.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");

router.use(protect);

router.post("/", MiniGoalController.createGoal);
router.get("/", MiniGoalController.getGoals);
router.patch("/:id/status", MiniGoalController.updateStatus);
router.delete("/:id", MiniGoalController.deleteGoal);

// Admin routes
router.get("/user/:userId", restrictTo("admin"), MiniGoalController.getGoalsByUserId);

module.exports = router;
