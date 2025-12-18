// controllers/downloadController.js
const AllowedEmail = require("../models/AllowedEmail");
const OTP = require("../models/OTP");
const DownloadFile = require("../models/DownloadFile");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Create transporter (same as in server.js)
const transporter = nodemailer.createTransport({
  service: "Outlook365",
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Verify email is in allowed list
exports.verifyEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Get allowed emails list (there should be only one document)
    let allowedEmailDoc = await AllowedEmail.findOne();
    
    // If no document exists, create one with empty array
    if (!allowedEmailDoc) {
      allowedEmailDoc = new AllowedEmail({ emails: [] });
      await allowedEmailDoc.save();
    }

    // Check if email is in the allowed list
    const isAllowed = allowedEmailDoc.emails.includes(email.toLowerCase().trim());

    if (!isAllowed) {
      return res.status(403).json({ 
        message: "Your email is not authorized to download these files. Please contact the administrator." 
      });
    }

    res.json({ 
      message: "Email verified", 
      email: email.toLowerCase().trim() 
    });
  } catch (error) {
    console.error("Error verifying email:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Generate and send OTP
exports.sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Verify email is in allowed list first
    let allowedEmailDoc = await AllowedEmail.findOne();
    if (!allowedEmailDoc) {
      return res.status(403).json({ message: "Email not authorized" });
    }

    const isAllowed = allowedEmailDoc.emails.includes(email.toLowerCase().trim());
    if (!isAllowed) {
      return res.status(403).json({ message: "Email not authorized" });
    }

    // Generate 6-digit OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();

    // Delete any existing OTPs for this email
    await OTP.deleteMany({ email: email.toLowerCase().trim() });

    // Create new OTP
    const otp = new OTP({
      email: email.toLowerCase().trim(),
      code: otpCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });
    await otp.save();

    // Send OTP email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "STIS-V 2025: Download Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">STIS-V 2025 Download Verification</h2>
          <p>Dear User,</p>
          <p>You have requested to download files from STIS-V 2025. Please use the following verification code:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #3498db; font-size: 32px; margin: 0; letter-spacing: 5px;">${otpCode}</h1>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you did not request this code, please ignore this email.</p>
          <p>Best regards,<br>STIS-V 2025 Organizing Team</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ OTP sent to ${email}`);

    res.json({ 
      message: "OTP sent successfully to your email",
      expiresIn: 600 // 10 minutes in seconds
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ message: "Failed to send OTP. Please try again." });
  }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: "Email and OTP code are required" });
    }

    // Find the most recent OTP for this email
    const otp = await OTP.findOne({ 
      email: email.toLowerCase().trim() 
    }).sort({ createdAt: -1 });

    if (!otp) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Check if OTP is expired
    if (new Date() > otp.expiresAt) {
      await OTP.deleteOne({ _id: otp._id });
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    // Check if OTP is already verified
    if (otp.verified) {
      return res.status(400).json({ message: "OTP has already been used" });
    }

    // Verify the code
    if (otp.code !== code) {
      return res.status(400).json({ message: "Invalid OTP code" });
    }

    // Mark OTP as verified
    otp.verified = true;
    await otp.save();

    // Generate a download token (valid for 1 hour)
    const downloadToken = crypto.randomBytes(32).toString('hex');
    
    // Store token in session or return it (we'll use it for download verification)
    // For simplicity, we'll return a success response and verify email on download

    res.json({ 
      message: "OTP verified successfully",
      token: downloadToken,
      expiresIn: 3600 // 1 hour
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get download files
exports.getDownloadFiles = async (req, res) => {
  try {
    const files = await DownloadFile.find().sort({ uploadedAt: -1 });
    res.json({ files });
  } catch (error) {
    console.error("Error fetching download files:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Download file (verify email is authorized)
exports.downloadFile = async (req, res) => {
  try {
    const { fileId, email } = req.query;

    if (!fileId || !email) {
      return res.status(400).json({ message: "File ID and email are required" });
    }

    // Verify email is in allowed list
    let allowedEmailDoc = await AllowedEmail.findOne();
    if (!allowedEmailDoc) {
      return res.status(403).json({ message: "Email not authorized" });
    }

    const isAllowed = allowedEmailDoc.emails.includes(email.toLowerCase().trim());
    if (!isAllowed) {
      return res.status(403).json({ message: "Email not authorized" });
    }

    // Find the file
    const file = await DownloadFile.findById(fileId);
    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    // Return file URL for download
    res.json({ 
      fileUrl: file.fileUrl,
      fileName: file.fileName
    });
  } catch (error) {
    console.error("Error downloading file:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Serve file directly (with email verification)
exports.serveFile = async (req, res) => {
  try {
    const { fileType } = req.params;
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Verify email is in allowed list
    let allowedEmailDoc = await AllowedEmail.findOne();
    if (!allowedEmailDoc) {
      return res.status(403).json({ message: "Email not authorized" });
    }

    const isAllowed = allowedEmailDoc.emails.includes(email.toLowerCase().trim());
    if (!isAllowed) {
      return res.status(403).json({ message: "Email not authorized" });
    }

    // Find the file
    const file = await DownloadFile.findOne({ fileType });
    if (!file || !file.filePath) {
      return res.status(404).json({ message: "File not found" });
    }

    // Check if file exists on disk (filePath is relative to public folder)
    const filePath = path.join(process.cwd(), "public", file.filePath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    // Determine content type based on file extension
    const ext = path.extname(file.fileName).toLowerCase();
    const contentTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed'
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.setHeader('Content-Type', contentType);

    // Send file
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error("Error serving file:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Admin: Upload files
exports.uploadFile = async (req, res) => {
  try {
    const { fileType } = req.body;
    const file = req.file;

    if (!file || !fileType) {
      return res.status(400).json({ message: "File and file type are required" });
    }

    if (!['abstract-booklet', 'papers-book'].includes(fileType)) {
      return res.status(400).json({ message: "Invalid file type" });
    }

    // Delete old file of same type if exists
    const oldFile = await DownloadFile.findOne({ fileType });
    if (oldFile && oldFile.filePath) {
      // filePath is relative to public folder
      const oldFilePath = path.join(process.cwd(), "public", oldFile.filePath);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
        console.log(`🗑️ Deleted old file: ${oldFile.fileName}`);
      }
    }
    await DownloadFile.deleteMany({ fileType });

    // Multer has already saved the file to disk
    // Rename it to include timestamp and random string for uniqueness and security
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const fileExtension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, fileExtension);
    const newFileName = `${fileType}-${timestamp}-${randomString}${fileExtension}`;
    const oldFilePath = file.path;
    const newFilePath = path.join(path.dirname(oldFilePath), newFileName);
    
    // Rename the file
    fs.renameSync(oldFilePath, newFilePath);

    // Save file info to database
    // Store path relative to public folder for serving
    const relativePath = path.join("downloads", newFileName);
    const downloadFile = new DownloadFile({
      fileType,
      fileName: file.originalname,
      fileUrl: `/api/downloads/file/${fileType}`, // API endpoint to serve the file (with email verification)
      filePath: relativePath // Store relative path from public folder
    });
    await downloadFile.save();

    console.log(`✅ File uploaded successfully: ${newFileName}`);

    res.json({ 
      message: "File uploaded successfully",
      file: downloadFile
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Admin: Get allowed emails
exports.getAllowedEmails = async (req, res) => {
  try {
    let allowedEmailDoc = await AllowedEmail.findOne();
    if (!allowedEmailDoc) {
      allowedEmailDoc = new AllowedEmail({ emails: [] });
      await allowedEmailDoc.save();
    }
    res.json({ emails: allowedEmailDoc.emails });
  } catch (error) {
    console.error("Error fetching allowed emails:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Admin: Add allowed email
exports.addAllowedEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    let allowedEmailDoc = await AllowedEmail.findOne();
    if (!allowedEmailDoc) {
      allowedEmailDoc = new AllowedEmail({ emails: [] });
    }

    const emailLower = email.toLowerCase().trim();

    // ✅ Check if email already exists
    if (allowedEmailDoc.emails.includes(emailLower)) {
      return res.status(409).json({
        message: "Email already present"
      });
    }

    // ✅ Add new email
    allowedEmailDoc.emails.push(emailLower);
    await allowedEmailDoc.save();

    res.status(201).json({
      message: "Email added successfully",
      emails: allowedEmailDoc.emails
    });

  } catch (error) {
    console.error("Error adding allowed email:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// Admin: Remove allowed email
exports.removeAllowedEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    let allowedEmailDoc = await AllowedEmail.findOne();
    if (!allowedEmailDoc) {
      return res.status(404).json({ message: "No allowed emails found" });
    }

    allowedEmailDoc.emails = allowedEmailDoc.emails.filter(
      e => e !== email.toLowerCase().trim()
    );
    await allowedEmailDoc.save();

    res.json({ 
      message: "Email removed successfully",
      emails: allowedEmailDoc.emails
    });
  } catch (error) {
    console.error("Error removing allowed email:", error);
    res.status(500).json({ message: "Server error" });
  }
};

