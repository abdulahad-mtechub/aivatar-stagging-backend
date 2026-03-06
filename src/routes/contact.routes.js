const express = require("express");
const router = express.Router();
const ContactController = require("../controllers/contact.controller");
const { protect, restrictTo } = require("../middlewares/auth.middleware");

// Public route to submit a query
router.post("/", ContactController.createContact);

// Admin route to get all queries
router.get("/", protect, restrictTo("admin"), ContactController.getAllContacts);

module.exports = router;
