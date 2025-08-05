const Paper = require('../models/Paper');
const { google } = require('googleapis');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.doc', '.docx', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .doc, .docx, and .pdf files are allowed'));
    }
  }
});

// Google Sheets configuration
const auth = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = "13WezerzzuaGoWN3mDEpnmZmgj4I0aS9h3i91X7Msw0g"; // Your actual Sheet ID
const PAPER_SHEET_NAME = 'Paper Submission'; // New sheet name for papers

// Upload file to Cloudinary
const uploadToCloudinary = async (file, folder = 'papers') => {
  try {
    console.log('📁 Starting Cloudinary upload for file:', file.originalname);
    console.log('📁 File buffer size:', file.buffer.length);
    console.log('📁 Folder:', folder);
    
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          folder: folder,
          format: path.extname(file.originalname).substring(1)
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('✅ Cloudinary upload successful:', result.secure_url);
            resolve(result);
          }
        }
      );
      
      uploadStream.end(file.buffer);
    });
  } catch (error) {
    console.error('❌ Cloudinary upload error:', error);
    throw new Error('File upload failed');
  }
};

// Add paper to Google Sheets
const addPaperToGoogleSheets = async (paperData) => {
  try {
    console.log('📊 Adding paper to Google Sheets:', {
      paperCode: paperData.paperCode,
      title: paperData.title,
      paperFile: paperData.paperFile,
      updatedPaperFile: paperData.updatedPaperFile
    });
    
    const values = [
      [
        paperData.paperCode, // Same as abstract code
        paperData.title,
        paperData.abstract,
        paperData.paperType,
        paperData.status,
        paperData.submittedAt,
        paperData.paperFile || '',
        paperData.updatedPaperFile || '',
        paperData.review?.recommendation || '',
        paperData.review?.reviewerComments || ''
      ]
    ];

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PAPER_SHEET_NAME}!A:J`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values }
    });

    return response.data.updates.updatedRange;
  } catch (error) {
    console.error('Google Sheets error:', error);
    throw new Error('Failed to update Google Sheets');
  }
};

// Update paper in Google Sheets
const updatePaperInGoogleSheets = async (paperData, rowIndex) => {
  try {
    const values = [
      [
        paperData.paperCode,
        paperData.title,
        paperData.firstAuthorName,
        paperData.firstAuthorEmail,
        paperData.presentingAuthorName,
        paperData.presentingAuthorEmail,
        paperData.track,
        paperData.status,
        paperData.submittedAt,
        paperData.paperFile || '',
        paperData.updatedPaperFile || '',
        paperData.review?.recommendation || '',
        paperData.review?.reviewerComments || ''
      ]
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PAPER_SHEET_NAME}!A${rowIndex}:M${rowIndex}`,
      valueInputOption: 'RAW',
      resource: { values }
    });
  } catch (error) {
    console.error('Google Sheets update error:', error);
    throw new Error('Failed to update Google Sheets');
  }
};

// Submit new paper
exports.submitPaper = [
  upload.single('paperFile'),
  async (req, res) => {
    try {
      const {
        title,
        abstract,
        paperType,
        abstractCode
      } = req.body;

      const userId = req.user.uid;

      // Validate required fields
      if (!title || !abstract || !paperType || !abstractCode) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Paper file is required' });
      }

      // Upload file to Cloudinary
      console.log('📤 Starting file upload to Cloudinary...');
      const cloudinaryResult = await uploadToCloudinary(req.file, 'papers');
      console.log('📤 Cloudinary result:', cloudinaryResult);

      // Create paper document
      console.log('📝 Creating paper document...');
      const paper = new Paper({
        title,
        abstract,
        paperType,
        paperFile: cloudinaryResult.secure_url,
        userId,
        abstractCode,
        paperCode: abstractCode // Paper code same as abstract code
      });
      console.log('📝 Paper document created with file URL:', paper.paperFile);

      console.log('💾 Saving paper to database...');
      await paper.save();
      console.log('💾 Paper saved successfully with ID:', paper._id);

      // Add to Google Sheets
      try {
        console.log('📊 Adding to Google Sheets...');
        const sheetRange = await addPaperToGoogleSheets(paper);
        console.log('📊 Google Sheets range:', sheetRange);
        const rowMatch = sheetRange.match(/A(\d+):M\d+/);
        if (rowMatch) {
          paper.googleSheetRow = parseInt(rowMatch[1]);
          await paper.save();
          console.log('📊 Google Sheets row updated:', paper.googleSheetRow);
        }
      } catch (sheetsError) {
        console.error('❌ Google Sheets error (non-blocking):', sheetsError);
        // Continue even if Google Sheets fails
      }

      res.status(201).json({
        message: 'Paper submitted successfully',
        paper: {
          paperCode: paper.paperCode,
          title: paper.title,
          status: paper.status
        }
      });

    } catch (error) {
      console.error('Paper submission error:', error);
      
      // Handle duplicate key error specifically
      if (error.code === 11000 && error.keyPattern && error.keyPattern.paperCode) {
        return res.status(409).json({ 
          error: 'A paper has already been submitted for this abstract code',
          details: 'Only one paper submission is allowed per abstract'
        });
      }
      
      res.status(500).json({ error: 'Failed to submit paper' });
    }
  }
];

// Get papers by user
exports.getPapersByUser = async (req, res) => {
  try {
    const userId = req.user.uid;
    const papers = await Paper.find({ userId }).sort({ submittedAt: -1 });
    res.json({ papers });
  } catch (error) {
    console.error('Error fetching papers:', error);
    res.status(500).json({ error: 'Failed to fetch papers' });
  }
};

// Get paper by code
exports.getPaperByCode = async (req, res) => {
  try {
    const { paperCode } = req.params;
    const userId = req.user.uid;

    const paper = await Paper.findOne({ paperCode, userId });
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    res.json({ paper });
  } catch (error) {
    console.error('Error fetching paper:', error);
    res.status(500).json({ error: 'Failed to fetch paper' });
  }
};

// Update paper (for revised submissions)
exports.updatePaper = [
  upload.single('updatedPaperFile'),
  async (req, res) => {
    try {
      const { paperCode } = req.params;
      const userId = req.user.uid;

      const paper = await Paper.findOne({ paperCode, userId });
      if (!paper) {
        return res.status(404).json({ error: 'Paper not found' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Updated paper file is required' });
      }

      // Upload updated file to Cloudinary
      const cloudinaryResult = await uploadToCloudinary(req.file, 'papers/updated');

      // Update paper
      paper.updatedPaperFile = cloudinaryResult.secure_url;
      paper.status = 'Revision Submitted';
      paper.updatedAt = new Date();

      await paper.save();

      // Update Google Sheets
      if (paper.googleSheetRow) {
        try {
          await updatePaperInGoogleSheets(paper, paper.googleSheetRow);
        } catch (sheetsError) {
          console.error('Google Sheets update error (non-blocking):', sheetsError);
        }
      }

      res.json({
        message: 'Paper updated successfully',
        paper: {
          paperCode: paper.paperCode,
          title: paper.title,
          status: paper.status
        }
      });

    } catch (error) {
      console.error('Paper update error:', error);
      res.status(500).json({ error: 'Failed to update paper' });
    }
  }
];

// Admin: Update paper review
exports.updatePaperReview = async (req, res) => {
  try {
    const { paperCode } = req.params;
    const {
      reviewerComments,
      technicalScore,
      presentationScore,
      overallScore,
      recommendation,
      reviewerName
    } = req.body;

    const paper = await Paper.findOne({ paperCode });
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Update review information
    paper.review = {
      reviewerComments,
      technicalScore: parseFloat(technicalScore),
      presentationScore: parseFloat(presentationScore),
      overallScore: parseFloat(overallScore),
      recommendation,
      reviewerName,
      reviewDate: new Date()
    };

    // Update status based on recommendation
    if (recommendation === 'Accept' || recommendation === 'Accept with Minor Revisions') {
      paper.status = 'Accepted';
    } else if (recommendation === 'Major Revisions Required') {
      paper.status = 'Revision Required';
    } else if (recommendation === 'Reject') {
      paper.status = 'Rejected';
    }

    await paper.save();

    // Update Google Sheets
    if (paper.googleSheetRow) {
      try {
        await updatePaperInGoogleSheets(paper, paper.googleSheetRow);
      } catch (sheetsError) {
        console.error('Google Sheets update error (non-blocking):', sheetsError);
      }
    }

    res.json({
      message: 'Paper review updated successfully',
      paper: {
        paperCode: paper.paperCode,
        title: paper.title,
        status: paper.status,
        review: paper.review
      }
    });

  } catch (error) {
    console.error('Paper review update error:', error);
    res.status(500).json({ error: 'Failed to update paper review' });
  }
};

// Admin: Get all papers
exports.getAllPapers = async (req, res) => {
  try {
    const papers = await Paper.find().sort({ submittedAt: -1 });
    res.json({ papers });
  } catch (error) {
    console.error('Error fetching all papers:', error);
    res.status(500).json({ error: 'Failed to fetch papers' });
  }
};

// Delete paper (admin only)
exports.deletePaper = async (req, res) => {
  try {
    const { paperCode } = req.params;
    
    const paper = await Paper.findOneAndDelete({ paperCode });
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Delete files from Cloudinary if they exist
    if (paper.paperFile) {
      try {
        await cloudinary.uploader.destroy(paper.paperFile);
      } catch (cloudinaryError) {
        console.error('Cloudinary delete error:', cloudinaryError);
      }
    }

    if (paper.updatedPaperFile) {
      try {
        await cloudinary.uploader.destroy(paper.updatedPaperFile);
      } catch (cloudinaryError) {
        console.error('Cloudinary delete error:', cloudinaryError);
      }
    }

    res.json({ message: 'Paper deleted successfully' });

  } catch (error) {
    console.error('Paper deletion error:', error);
    res.status(500).json({ error: 'Failed to delete paper' });
  }
}; 