const User = require("../models/User");

const registerUser = async (req, res) => {
  try {
    const {
      email,
      password,
      confirmPassword,
      phone,
      givenName,
      familyName,
      fullName,
      country,
      affiliation,
    } = req.body;

    // Validate passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
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

    // Save user to database
    await newUser.save();

    console.log("✅ User Registered:", newUser);
    res.status(201).json({ message: "User registered successfully!" });
  } catch (error) {
    console.error("❌ Error Registering User:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { registerUser };