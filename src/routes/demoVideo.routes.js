const express = require("express");
const router = express.Router();
const DemoVideoController = require("../controllers/demoVideo.controller");

// Auth NOT applied: publicly accessible routes (active videos only)
router.get("/", DemoVideoController.listActiveForUser);
router.get("/:id", DemoVideoController.getActiveById);

module.exports = router;
