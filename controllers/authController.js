const admin = require("../config/firebase");
const User = require("../models/User");

exports.registerUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName, fullName, telephone, country, affiliation } = req.body;

    // Create user in Firebase Authentication
    const userRecord = await admin.auth().createUser({ email, password });

    // Store additional details in MongoDB
    const newUser = new User({
      uid: userRecord.uid,
      email,
      firstName,
      lastName,
      fullName,
      telephone,
      country,
      affiliation,
    });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully", uid: userRecord.uid });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email } = req.body;

    // Fetch user details from MongoDB
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "Login successful", user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUser = async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    await admin.auth().generatePasswordResetLink(email);
    res.json({ message: "Password reset link sent to email" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
