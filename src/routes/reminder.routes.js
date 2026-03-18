const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const reminderController = require("../controllers/reminder.controller");

router.use(protect);

router.get("/me", reminderController.getMyReminders);
router.patch("/me", reminderController.updateMyReminders);

module.exports = router;

