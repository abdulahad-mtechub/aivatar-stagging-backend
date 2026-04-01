const express = require("express");
const router = express.Router();
const RewardController = require("../controllers/reward.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");

// ─── Admin: Reward Rule Management ───────────────────────────────────────────
router.get("/leaderboard", protect, restrictTo("admin"), RewardController.getLeaderboard);
router.get("/rules", RewardController.getAllRules);
router.get("/rules/:id", protect, restrictTo("admin"), RewardController.getRuleById);
router.post("/rules", protect, restrictTo("admin"), RewardController.createRule);
router.put("/rules/:id", protect, restrictTo("admin"), RewardController.updateRule);
router.delete("/rules/:id", protect, restrictTo("admin"), RewardController.deleteRule);

// ─── User: Earn & Balance ─────────────────────────────────────────────────────
router.post("/earn", protect, RewardController.earnPoints);
router.get("/balance", protect, RewardController.getMyBalance);
router.get("/history", protect, RewardController.getMyEarningHistory);

module.exports = router;
