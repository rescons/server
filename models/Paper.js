const mongoose = require('mongoose');

const paperSchema = new mongoose.Schema({
  // Basic paper information
  title: { type: String, required: true },
  abstract: { type: String, required: true },
  keywords: [String],
  
  // Author information
  firstAuthorName: { type: String, required: true },
  firstAuthorAffiliation: { type: String, required: true },
  firstAuthorEmail: { type: String, required: true },
  
  presentingAuthorName: { type: String, required: true },
  presentingAuthorAffiliation: { type: String, required: true },
  presentingAuthorEmail: { type: String, required: true },
  
  otherAuthors: [{
    name: String,
    affiliation: String,
    email: String
  }],
  
  // File information
  paperFile: { type: String }, // Cloudinary URL for original paper
  updatedPaperFile: { type: String }, // Cloudinary URL for updated paper
  
  // Status and tracking
  paperCode: { type: String, unique: true, required: true },
  status: {
    type: String,
    enum: ['Submitted', 'Under Review', 'Review Completed', 'Accepted', 'Rejected', 'Revision Required'],
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
  
  // Abstract association (if paper is based on an abstract)
  abstractCode: { type: String },
  
  // Google Sheets tracking
  googleSheetRow: { type: Number },
  
  // Additional metadata
  paperType: {
    type: String,
    enum: ['Full Paper', 'Short Paper', 'Review Paper'],
    default: 'Full Paper'
  },
  
  track: {
    type: String,
    enum: ['Ironmaking', 'Steelmaking', 'Refractories', 'Surface Engineering', 'Materials Processing', 'Other'],
    required: true
  }
}, { timestamps: true });

// Generate paper code before saving
paperSchema.pre('save', function(next) {
  if (!this.paperCode) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.paperCode = `PAPER_${timestamp}_${random}`;
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Paper', paperSchema); 