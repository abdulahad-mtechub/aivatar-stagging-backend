const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");
const { protect } = require("../middlewares/auth.middleware");

router.use(protect);

router.patch("/update-token", notificationController.updateToken);
router.post("/test-send", notificationController.testSend);

module.exports = router;
