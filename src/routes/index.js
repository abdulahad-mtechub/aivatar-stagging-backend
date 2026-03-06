const express = require("express");
const router = express.Router();
const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const postRoutes = require("./post.routes");
const profileRoutes = require("./profile.routes");
const contentRoutes = require("./content.routes");
const mealRoutes = require("./meal.routes");
const mealPlanRoutes = require("./mealPlan.routes");
const contactRoutes = require("./contact.routes");
const workoutRoutes = require("./workout.routes");
const rewardRoutes = require("./reward.routes");
const redeemRoutes = require("./redeem.routes");
const badgeRoutes = require("./badge.routes");

// Mount route modules
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/posts", postRoutes);
router.use("/profiles", profileRoutes);
router.use("/content", contentRoutes);
router.use("/meals", mealRoutes);
router.use("/meal-plans", mealPlanRoutes);
router.use("/contacts", contactRoutes);
router.use("/workouts", workoutRoutes);
router.use("/rewards", rewardRoutes);
router.use("/redeem", redeemRoutes);
router.use("/badges", badgeRoutes);

module.exports = router;

