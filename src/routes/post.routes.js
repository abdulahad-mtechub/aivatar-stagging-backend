const express = require("express");
const router = express.Router();
const postController = require("../controllers/post.controller");
const { protect } = require("../middlewares/auth.middleware");

// CRUD routes
router.get("/", protect, postController.getAllPosts);
router.get("/:id", protect, postController.getPostById);
router.post("/", protect, postController.createPost);
router.put("/:id", protect, postController.updatePost);
router.delete("/:id", protect, postController.deletePost);

module.exports = router;

