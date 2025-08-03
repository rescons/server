const express = require('express');
const router = express.Router();
const paperController = require('../controllers/paperController');
const { verifyToken } = require('../server');

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