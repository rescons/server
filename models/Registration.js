const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  country: { type: String, required: true },
  institution: String,
  registrationType: {
    type: String,
    enum: ['regular', 'student', 'earlyBird'],
    required: true
  },
  dietaryRequirements: String,
  specialNeeds: String,
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  paymentId: String,
  transactionId: String,
  amount: Number,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Registration', registrationSchema);






// const mongoose = require('mongoose');

// const UserSchema = new mongoose.Schema({
//     email: {
//         type: String,
//         required: true,
//         unique: true,
//         trim: true,
//         lowercase: true,
//     },
//     password: {
//         type: String,
//         required: true,
//     },
//     telephone: {
//         type: String,
//         required: true,
//     },
//     givenName: {
//         type: String,
//         required: true,
//         trim: true,
//     },
//     familyName: {
//         type: String,
//         required: true,
//         trim: true,
//     },
//     country: {
//         type: String,
//         required: true,
//     },
//     affiliation: {
//         type: String,
//         required: true,
//     },
// }, { timestamps: true });

// const User = mongoose.model('User', UserSchema);

// module.exports = User;
