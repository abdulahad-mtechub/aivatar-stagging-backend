const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { protect } = require("../middlewares/auth.middleware");

// Public routes
router.post("/login", authController.login);
router.post("/register", authController.register);
router.post("/resend-otp", authController.resendOtp);
router.post("/verify-otp", authController.verifyOtp);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

// Protected routes
router.get("/profile", protect, authController.getProfile);
router.post("/change-password", protect, authController.changePassword);

module.exports = router;

