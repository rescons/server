// models/DownloadFile.js
const mongoose = require("mongoose");

const downloadFileSchema = new mongoose.Schema({
  fileType: {
    type: String,
    required: true,
    enum: ['abstract-booklet', 'papers-book']
  },
  fileName: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: false // Optional for backward compatibility
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  uploadedBy: {
    type: String,
    default: 'admin'
  }
});

module.exports = mongoose.model("DownloadFile", downloadFileSchema);

