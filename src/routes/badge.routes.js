const express = require("express");
const router = express.Router();
const BadgeController = require("../controllers/badge.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");

// ─── User Facing ──────────────────────────────────────────────────────────────
router.get("/", protect, BadgeController.getAllBadges);
router.get("/my-badge", protect, BadgeController.getMyBadge);

// ─── Admin Facing ─────────────────────────────────────────────────────────────
router.post("/", protect, restrictTo("admin"), BadgeController.createBadge);
router.put("/:id", protect, restrictTo("admin"), BadgeController.updateBadge);
router.delete("/:id", protect, restrictTo("admin"), BadgeController.deleteBadge);

module.exports = router;
