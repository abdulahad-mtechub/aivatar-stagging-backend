const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { protect } = require("../middlewares/auth.middleware");
const { restrictTo } = require("../middlewares/auth.middleware");

// All user routes require authentication
router.use(protect);

// Admin only routes
router.get("/", restrictTo("admin"), userController.getAllUsers);
router.get("/:id", restrictTo("admin"), userController.getUserById);
router.put("/:id", restrictTo("admin"), userController.updateUser);
router.delete("/:id", restrictTo("admin"), userController.deleteUser);

module.exports = router;

