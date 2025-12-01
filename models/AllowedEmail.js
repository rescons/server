// models/AllowedEmail.js
const mongoose = require("mongoose");

const allowedEmailSchema = new mongoose.Schema({
  emails: {
    type: [String],
    required: true,
    default: []
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
allowedEmailSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("AllowedEmail", allowedEmailSchema);

