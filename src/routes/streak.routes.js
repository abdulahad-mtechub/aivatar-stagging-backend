const express = require("express");
const router = express.Router();
const streakController = require("../controllers/streak.controller");
const { protect } = require("../middlewares/auth.middleware");

// Protect all streak routes
router.use(protect);

/**
 * @route   POST /api/streaks
 * @desc    Record activity for today
 * @body    { activity_type: 'workout' | 'meal' | 'general' }
 * @access  Private
 */
router.post("/", streakController.createStreak);

/**
 * @route   GET /api/streaks/summary
 * @desc    Get all streak types summary (dashboard / home screen)
 * @access  Private
 */
router.get("/summary", streakController.getStreakSummary);

/**
 * @route   GET /api/streaks
 * @desc    Get streak info — all types or filtered by ?activity_type=workout
 * @access  Private
 */
router.get("/", streakController.getStreaks);

/**
 * @route   POST /api/streaks/restore
 * @desc    Restore expired streaks
 * @body    { activity_type: 'workout' } (optional — omit to restore all)
 * @access  Private
 */
router.post("/restore", streakController.restoreStreaks);

module.exports = router;
