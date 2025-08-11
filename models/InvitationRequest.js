const mongoose = require('mongoose');

const InvitationRequestSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  name: String,
  address: String,
  passportNumber: String,
  passportExpiry: String,
  country: String,
  nationality: String,
  dob: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('InvitationRequest', InvitationRequestSchema); 