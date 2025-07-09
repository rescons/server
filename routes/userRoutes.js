// routes/userRoutes.js
const express = require("express");
const User = require("../models/User");
const router = express.Router();

// @route   POST /api/users/register
// @desc    Register a new user
// @access  Public
router.post("/register", async (req, res) => {
  try {
    const { email, password, phone, givenName, familyName, fullName, country, affiliation } = req.body;

    // Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create new user
    const newUser = new User({
      email,
      password, 
      phone,
      givenName,
      familyName,
      fullName,
      country,
      affiliation,
    });

    await newUser.save();

    console.log("✅ User Registered:", newUser);
    res.status(201).json({ message: "User registered successfully", user: newUser });
  } catch (error) {
    console.error("❌ Error Registering User:", error.message);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;