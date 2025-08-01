const express = require('express');
const router = express.Router();
const paperController = require('../controllers/paperController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Paper submission routes
router.post('/submit', paperController.submitPaper);
router.get('/user', paperController.getPapersByUser);
router.get('/:paperCode', paperController.getPaperByCode);
router.put('/:paperCode/update', paperController.updatePaper);

// Admin routes (you may want to add admin middleware here)
router.get('/admin/all', paperController.getAllPapers);
router.put('/admin/:paperCode/review', paperController.updatePaperReview);
router.delete('/admin/:paperCode', paperController.deletePaper);

module.exports = router; 