const express = require("express");
const router = express.Router();
const profileController = require("../controllers/profile.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");

// All profile routes require authentication
router.use(protect);

// Authenticated user — own profile
router.get("/me", profileController.getMyProfile);
router.post("/", profileController.createProfile);
router.put("/:id", profileController.updateProfile);
router.delete("/:id", profileController.deleteProfile);



module.exports = router;
