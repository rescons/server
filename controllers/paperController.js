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
    const allowedTypes = ['.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .doc and .docx files are allowed. PDF files are not supported.'));
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
          format: path.extname(file.originalname).substring(1),
          public_id: `${folder}/${path.parse(file.originalname).name}_${Date.now()}`
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('✅ Cloudinary upload successful:', result.secure_url);
            console.log('📁 File type: Document');
            console.log('📁 Resource type:', result.resource_type);
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

// Find paper row in Google Sheets
const findPaperRowInGoogleSheets = async (paperCode) => {
  try {
    console.log('🔍 Searching for paper in Google Sheets:', paperCode);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PAPER_SHEET_NAME}!A:A`
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === paperCode);
    
    if (rowIndex !== -1) {
      console.log('📊 Found paper in Google Sheets at row:', rowIndex + 1);
      return rowIndex + 1;
    } else {
      console.log('❌ Paper not found in Google Sheets');
      return null;
    }
  } catch (error) {
    console.error('Google Sheets search error:', error);
    return null;
  }
};

// Update paper in Google Sheets
const updatePaperInGoogleSheets = async (paperData, rowIndex) => {
  try {
    console.log('📊 Updating paper in Google Sheets:', {
      paperCode: paperData.paperCode,
      title: paperData.title,
      paperFile: paperData.paperFile,
      updatedPaperFile: paperData.updatedPaperFile,
      status: paperData.status,
      rowIndex: rowIndex
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
        paperData.updatedPaperFile || '', // Column H - Updated Paper File URL
        paperData.review?.recommendation || '',
        paperData.review?.reviewerComments || ''
      ]
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PAPER_SHEET_NAME}!A${rowIndex}:J${rowIndex}`,
      valueInputOption: 'RAW',
      resource: { values }
    });
    
    console.log('📊 Google Sheets updated successfully for row:', rowIndex);
    console.log('📊 Updated Paper File URL in Column H:', paperData.updatedPaperFile);
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
                 const rowMatch = sheetRange.match(/A(\d+):J\d+/);
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

      // Update Google Sheets - Enhanced approach
      console.log('📊 Starting Google Sheets update for paper:', paper.paperCode);
      console.log('📊 Updated Paper File URL:', paper.updatedPaperFile);
      
      let rowToUpdate = paper.googleSheetRow;
      
      // If no row is stored, try to find it
      if (!rowToUpdate) {
        console.log('⚠️ No Google Sheets row stored, searching for paper...');
        rowToUpdate = await findPaperRowInGoogleSheets(paper.paperCode);
        if (rowToUpdate) {
          // Update the paper with the correct row number
          paper.googleSheetRow = rowToUpdate;
          await paper.save();
          console.log('📊 Updated paper with Google Sheets row:', paper.googleSheetRow);
        }
      }
      
      // Update Google Sheets if we have a row
      if (rowToUpdate) {
        try {
          console.log('📊 Updating Google Sheets for row:', rowToUpdate);
          await updatePaperInGoogleSheets(paper, rowToUpdate);
          console.log('📊 Google Sheets update completed successfully');
        } catch (sheetsError) {
          console.error('Google Sheets update error (non-blocking):', sheetsError);
        }
      } else {
        console.log('❌ Could not find paper in Google Sheets for update');
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

    // Update review information - all fields are optional
    const reviewData = {
      reviewDate: new Date()
    };

    // Only add fields that are provided
    if (reviewerComments && reviewerComments.trim()) {
      reviewData.reviewerComments = reviewerComments.trim();
    }
    if (technicalScore && technicalScore !== '') {
      reviewData.technicalScore = parseFloat(technicalScore);
    }
    if (presentationScore && presentationScore !== '') {
      reviewData.presentationScore = parseFloat(presentationScore);
    }
    if (overallScore && overallScore !== '') {
      reviewData.overallScore = parseFloat(overallScore);
    }
    if (recommendation && recommendation.trim()) {
      reviewData.recommendation = recommendation.trim();
    }
    if (reviewerName && reviewerName.trim()) {
      reviewData.reviewerName = reviewerName.trim();
    }

    paper.review = reviewData;

    // Update status based on recommendation (only if recommendation is provided)
    if (recommendation && recommendation.trim()) {
      if (recommendation === 'Accept' || recommendation === 'Accept with Minor Revisions') {
        paper.status = 'Accepted';
      } else if (recommendation === 'Major Revisions Required') {
        paper.status = 'Revision Required';
      } else if (recommendation === 'Reject') {
        paper.status = 'Rejected';
      }
    }

    await paper.save();

    // Update Google Sheets - Enhanced approach for reviews
    console.log('📊 Starting Google Sheets review update for paper:', paper.paperCode);
    
    let rowToUpdate = paper.googleSheetRow;
    
    // If no row is stored, try to find it
    if (!rowToUpdate) {
      console.log('⚠️ No Google Sheets row stored for review, searching for paper...');
      rowToUpdate = await findPaperRowInGoogleSheets(paper.paperCode);
      if (rowToUpdate) {
        // Update the paper with the correct row number
        paper.googleSheetRow = rowToUpdate;
        await paper.save();
        console.log('📊 Updated paper with Google Sheets row:', paper.googleSheetRow);
      }
    }
    
    // Update Google Sheets if we have a row
    if (rowToUpdate) {
      try {
        console.log('📊 Updating Google Sheets for review at row:', rowToUpdate);
        await updatePaperInGoogleSheets(paper, rowToUpdate);
        console.log('📊 Google Sheets review update completed successfully');
      } catch (sheetsError) {
        console.error('Google Sheets update error (non-blocking):', sheetsError);
      }
    } else {
      console.log('❌ Could not find paper in Google Sheets for review update');
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