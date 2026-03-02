const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { protect } = require("../middlewares/auth.middleware");

// Public routes
router.post("/login", authController.login);
router.post("/register", authController.register);

// Protected routes
router.get("/profile", protect, authController.getProfile);
router.post("/change-password", protect, authController.changePassword);

module.exports = router;

