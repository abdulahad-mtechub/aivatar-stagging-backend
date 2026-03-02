const express = require("express");
const router = express.Router();
const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const postRoutes = require("./post.routes");

// Mount route modules
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/posts", postRoutes);

module.exports = router;

