// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  givenName: { type: String, required: true },
  familyName: { type: String },
  fullName: { type: String, required: true },
  country: { type: String, required: true },
  affiliation: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);