const express = require("express");
const router = express.Router();
const contentController = require("../controllers/content.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");

// Public route to get content
router.get("/:type", contentController.getContentByType);

// Protected admin route to upsert content
router.post("/", protect, restrictTo("admin"), contentController.upsertContent);
router.get("/:type/versions", protect, restrictTo("admin"), contentController.getContentVersionsByType);
router.patch("/versions/:id/activate", protect, restrictTo("admin"), contentController.activateContentVersion);

module.exports = router;
