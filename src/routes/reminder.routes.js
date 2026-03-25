const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const reminderController = require("../controllers/reminder.controller");

router.get("/me", protect, reminderController.getMyReminders);
router.patch("/me", protect, reminderController.updateMyReminders);

module.exports = router;

