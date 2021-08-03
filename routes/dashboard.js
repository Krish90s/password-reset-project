const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const dashboard = "Dashboard";

router.get("/", auth, async (req, res) => {
  res.send(dashboard);
});

module.exports = router;
