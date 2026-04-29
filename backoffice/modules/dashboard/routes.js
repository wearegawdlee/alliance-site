const express = require("express");
const service = require("./service");
const router = express.Router();
router.get("/", async (req, res, next) => {
  try {
    res.render("dashboard/index", {
      title: "Dashboard",
      dashboard: await service.getDashboard(),
    });
  } catch (e) {
    next(e);
  }
});
module.exports = router;
