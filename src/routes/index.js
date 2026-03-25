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
const workoutPlanRoutes = require("./workoutPlan.routes");
const rewardRoutes = require("./reward.routes");
const redeemRoutes = require("./redeem.routes");
const badgeRoutes = require("./badge.routes");
const streakRoutes = require("./streak.routes");
const ingredientRoutes = require("./ingredient.routes");
const groceryRoutes = require("./grocery.routes");
const measurementRoutes = require("./measurement.routes");
const reportRoutes = require("./report.routes");
const notificationRoutes = require("./notification.routes");
const reminderRoutes = require("./reminder.routes");
const stripeRoutes = require("./stripe.routes");

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
router.use("/workout-plans", workoutPlanRoutes);
router.use("/rewards", rewardRoutes);
router.use("/redeem", redeemRoutes);
router.use("/badges", badgeRoutes);
router.use("/streaks", streakRoutes);
router.use("/ingredients", ingredientRoutes);
router.use("/grocery", groceryRoutes);
router.use("/measurements", measurementRoutes);
router.use("/reports", reportRoutes);
router.use("/notifications", notificationRoutes);
router.use("/reminders", reminderRoutes);
router.use("/stripe", stripeRoutes);

module.exports = router;

