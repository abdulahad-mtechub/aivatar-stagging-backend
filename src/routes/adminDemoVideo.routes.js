const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middlewares/auth.middleware");
const DemoVideoController = require("../controllers/demoVideo.controller");

router.use(protect);
router.use(restrictTo("admin"));

router.get("/", DemoVideoController.listAllAdmin);
router.get("/:id", DemoVideoController.getByIdAdmin);
router.post("/", DemoVideoController.create);
router.put("/:id", DemoVideoController.update);
router.delete("/:id", DemoVideoController.remove);

module.exports = router;
