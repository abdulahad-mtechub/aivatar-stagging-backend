const express = require("express");
const router = express.Router();
const RedeemController = require("../controllers/redeem.controller");
const { protect } = require("../middlewares/auth.middleware");

// ─── User: Redeem Coins ───────────────────────────────────────────────────────
router.post("/", protect, RedeemController.redeemCoins);
router.get("/history", protect, RedeemController.getMyRedeemHistory);

module.exports = router;
