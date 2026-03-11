const express = require("express");
const router = express.Router();
const redeemController = require("../controllers/redeem.controller");
const { protect } = require("../middlewares/auth.middleware");

// ─── User: Redeem Coins ───────────────────────────────────────────────────────
router.post("/", protect, redeemController.redeemCoins);
router.get("/history", protect, redeemController.getMyRedeemHistory);

module.exports = router;
