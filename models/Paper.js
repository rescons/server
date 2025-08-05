const mongoose = require('mongoose');

const paperSchema = new mongoose.Schema({
  // Basic paper information
  title: { type: String, required: true },
  abstract: { type: String, required: true },
  
  // File information
  paperFile: { type: String }, // Cloudinary URL for original paper
  updatedPaperFile: { type: String }, // Cloudinary URL for updated paper
  
  // Status and tracking
  paperCode: { type: String, unique: true, required: true },
  status: {
    type: String,
    enum: ['Submitted', 'Under Review', 'Review Completed', 'Accepted', 'Rejected', 'Revision Required', 'Revision Submitted'],
    default: 'Submitted'
  },
  
  // Review information
  review: {
    reviewerComments: String,
    technicalScore: Number,
    presentationScore: Number,
    overallScore: Number,
    recommendation: {
      type: String,
      enum: ['Accept', 'Accept with Minor Revisions', 'Major Revisions Required', 'Reject'],
      default: null
    },
    reviewDate: Date,
    reviewerName: String
  },
  
  // Submission tracking
  submittedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  
  // User association
  userId: { type: String, required: true },
  
  // Abstract association (paper code will be same as abstract code)
  abstractCode: { type: String, required: true },
  
  // Google Sheets tracking
  googleSheetRow: { type: Number },
  
  // Paper type (only two options)
  paperType: {
    type: String,
    enum: ['FULL PAPER', 'EXTENDED ABSTRACT'],
    required: true
  }
}, { timestamps: true });

// Paper code will be same as abstract code
paperSchema.pre('save', function(next) {
  if (!this.paperCode && this.abstractCode) {
    this.paperCode = this.abstractCode;
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Paper', paperSchema); 