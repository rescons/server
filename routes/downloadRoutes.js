// routes/downloadRoutes.js
const express = require("express");
const router = express.Router();
const downloadController = require("../controllers/downloadController");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure multer for file uploads - using disk storage for large files
// Store in public folder so files can be served statically
const downloadsDir = path.join(process.cwd(), "public", "downloads");
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, downloadsDir);
  },
  filename: function (req, file, cb) {
    // Store with original name temporarily, will be renamed in controller
    cb(null, file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 200 * 1024 * 1024 // 200MB limit for large booklets
  }
});

// Public routes
router.post("/verify-email", downloadController.verifyEmail);
router.post("/send-otp", downloadController.sendOTP);
router.post("/verify-otp", downloadController.verifyOTP);
router.get("/files", downloadController.getDownloadFiles);
router.get("/download", downloadController.downloadFile);
router.get("/file/:fileType", downloadController.serveFile); // Serve file directly

// Admin routes (you may want to add admin authentication middleware here)
router.post("/admin/upload", upload.single("file"), downloadController.uploadFile);
router.get("/admin/allowed-emails", downloadController.getAllowedEmails);
router.post("/admin/add-email", downloadController.addAllowedEmail);
router.post("/admin/remove-email", downloadController.removeAllowedEmail);

module.exports = router;

