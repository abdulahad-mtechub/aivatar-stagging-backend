const express = require("express");
const router = express.Router();
const DemoVideoController = require("../controllers/demoVideo.controller");

// Auth applied in index.js: protect before this router mounts (active videos only)
router.get("/", DemoVideoController.listActiveForUser);
router.get("/:id", DemoVideoController.getActiveById);

module.exports = router;
