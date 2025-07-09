const express = require("express");
const { registerUser, loginUser, getUser, forgotPassword } = require("../controllers/authController");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/user/:uid", getUser);
router.post("/forgot-password", forgotPassword);

module.exports = router;


