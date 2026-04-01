const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const stripeController = require("../controllers/stripe.controller");

// Create checkout session
router.post("/create-session", protect, stripeController.createSession);

// Debug session retrieval
router.get("/session/:id", protect, stripeController.getSession);

// Verify payment after checkout (no webhooks)
router.post("/verify", protect, stripeController.verify);

// Get last subscription for current user
router.get("/my-last-subscription", protect, stripeController.getMyLastSubscription);

// Billing portal
router.post("/create-portal-session", protect, stripeController.createPortalSession);
router.get("/customer-portal", protect, stripeController.getCustomerPortal);
router.post("/cancel-subscription", protect, stripeController.cancelSubscription);
router.post("/upgrade-preview", protect, stripeController.upgradePreview);
router.post("/upgrade-subscription", protect, stripeController.upgradeSubscription);

module.exports = router;

