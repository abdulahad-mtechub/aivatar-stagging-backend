const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const reminderController = require("../controllers/reminder.controller");

router.get("/me", protect, reminderController.getMyReminders);
router.patch("/me", protect, reminderController.updateMyReminders);
router.post("/", protect, reminderController.addReminder);
router.post("/bulk", protect, reminderController.bulkAddReminders);
router.patch("/:id", protect, reminderController.updateReminder);
router.delete("/:id", protect, reminderController.deleteReminder);

module.exports = router;

