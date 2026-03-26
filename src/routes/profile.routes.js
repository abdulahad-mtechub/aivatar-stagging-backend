const express = require("express");
const router = express.Router();
const profileController = require("../controllers/profile.controller");
const { protect } = require("../middlewares/auth.middleware");

// Authenticated user — own profile
router.get("/me", protect, profileController.getMyProfile);
router.put("/me/goal", protect, profileController.updateMyGoalSettings);
router.post("/", protect, profileController.createProfile);
router.put("/:id", protect, profileController.updateProfile);
router.delete("/:id", protect, profileController.deleteProfile);



module.exports = router;
