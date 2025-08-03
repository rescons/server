const express = require('express');
const router = express.Router();
const paperController = require('../controllers/paperController');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT token (same as in server.js)
const verifyToken = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Token is not valid" });
  }
};

// Apply authentication middleware to all routes
router.use(verifyToken);

// Paper submission routes
console.log('📝 Registering paper routes...');

// Specific routes first (before parameterized routes)
router.post('/submit', (req, res, next) => {
  console.log('📝 Paper submit route hit');
  paperController.submitPaper(req, res, next);
});
router.get('/user', paperController.getPapersByUser);

// Admin routes (before parameterized routes)
router.get('/admin/all', paperController.getAllPapers);

// Parameterized routes last
router.get('/:paperCode', paperController.getPaperByCode);
router.put('/:paperCode/update', paperController.updatePaper);
router.put('/admin/:paperCode/review', paperController.updatePaperReview);
router.delete('/admin/:paperCode', paperController.deletePaper);

module.exports = router; 