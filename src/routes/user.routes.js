const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { protect } = require("../middlewares/auth.middleware");
const { restrictTo } = require("../middlewares/auth.middleware");

// User routes
router.delete("/me", protect, userController.deleteMe);

// Admin only routes
router.get("/", protect, restrictTo("admin"), userController.getAllUsers);
router.get("/:id", protect, restrictTo("admin"), userController.getUserById);
router.put("/:id", protect, restrictTo("admin"), userController.updateUser);
router.delete("/:id", protect, restrictTo("admin"), userController.deleteUser);

module.exports = router;

