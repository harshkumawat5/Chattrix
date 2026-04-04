const express = require("express");
const { getSession, endSession } = require("../controllers/session.controller");
const { auth } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/:id",      auth, getSession);
router.patch("/:id/end", auth, endSession);

module.exports = router;
