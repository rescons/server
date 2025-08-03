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
const PAPER_SHEET_NAME = 'Abstract Submissions'; // Sheet name for papers

// Upload file to Cloudinary
const uploadToCloudinary = async (file, folder = 'papers') => {
  try {
    const result = await cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        folder: folder,
        format: path.extname(file.originalname).substring(1)
      },
      (error, result) => {
        if (error) throw error;
        return result;
      }
    ).end(file.buffer);
    
    return result;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('File upload failed');
  }
};

// Add paper to Google Sheets
const addPaperToGoogleSheets = async (paperData) => {
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

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PAPER_SHEET_NAME}!A:M`,
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
        keywords,
        firstAuthorName,
        firstAuthorAffiliation,
        firstAuthorEmail,
        presentingAuthorName,
        presentingAuthorAffiliation,
        presentingAuthorEmail,
        otherAuthors,
        track,
        paperType,
        abstractCode
      } = req.body;

      const userId = req.user.uid;

      // Validate required fields
      if (!title || !abstract || !firstAuthorName || !presentingAuthorName || !track) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Paper file is required' });
      }

      // Upload file to Cloudinary
      const cloudinaryResult = await uploadToCloudinary(req.file, 'papers');

      // Parse other authors if provided
      let parsedOtherAuthors = [];
      if (otherAuthors) {
        try {
          parsedOtherAuthors = JSON.parse(otherAuthors);
        } catch (e) {
          console.error('Error parsing other authors:', e);
        }
      }

      // Generate paper code
      const generatePaperCode = () => {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `PAPER_${timestamp}_${random}`;
      };

      // Create paper document
      const paper = new Paper({
        title,
        abstract,
        keywords: keywords ? keywords.split(',').map(k => k.trim()) : [],
        firstAuthorName,
        firstAuthorAffiliation,
        firstAuthorEmail,
        presentingAuthorName,
        presentingAuthorAffiliation,
        presentingAuthorEmail,
        otherAuthors: parsedOtherAuthors,
        track,
        paperType: paperType || 'Full Paper',
        paperFile: cloudinaryResult.secure_url,
        userId,
        abstractCode,
        paperCode: generatePaperCode() // Generate paper code explicitly
      });

      await paper.save();

      // Add to Google Sheets
      try {
        const sheetRange = await addPaperToGoogleSheets(paper);
        const rowMatch = sheetRange.match(/A(\d+):M\d+/);
        if (rowMatch) {
          paper.googleSheetRow = parseInt(rowMatch[1]);
          await paper.save();
        }
      } catch (sheetsError) {
        console.error('Google Sheets error (non-blocking):', sheetsError);
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