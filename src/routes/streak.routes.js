const express = require("express");
const router = express.Router();
const streakController = require("../controllers/streak.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// Protect all streak routes
router.use(authMiddleware.protect);

/**
 * @route   POST /api/streaks
 * @desc    Record activity for today
 * @access  Private
 */
router.post("/", streakController.createStreak);

/**
 * @route   GET /api/streaks
 * @desc    Get current streak count and evaluate
 * @access  Private
 */
router.get("/", streakController.getStreaks);

/**
 * @route   POST /api/streaks/restore
 * @desc    Restore expired streaks
 * @access  Private
 */
router.post("/restore", streakController.restoreStreaks);

module.exports = router;
