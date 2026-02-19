const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');

router.post('/attachments', (req, res) => {
  // TO DO: implement /attachments endpoint
  res.json({
    status: 'success',
    message: 'Attachments endpoint'
  });
});

router.post('/process', async (req, res) => {
  try {
    console.log('🔍 Starting OCR processing with progress tracking...');
    
    // Get limit from request body or default to 10
    const { limit = 10 } = req.body || {};
    
    // Import the OCR progress controller function
    const { startOcrWithProgress } = require('../controllers/ocr-progress.controller');
    
    // Start OCR with progress tracking
    startOcrWithProgress(req, res, limit);
    
  } catch (error) {
    console.error('❌ OCR process error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start OCR processing',
      error: error.message
    });
  }
});

// Get email summary statistics
router.get('/summary', async (req, res) => {
  try {
    const totalEmails = await prisma.email.count();
    const totalAttachments = await prisma.attachment.count();
    
    const processedAttachments = await prisma.attachment.count({
      where: {
        extractedText: {
          not: null
        }
      }
    });
    
    const pendingAttachments = totalAttachments - processedAttachments;
    
    const summary = {
      totalEmails,
      totalAttachments,
      processedAttachments,
      pendingAttachments,
      completionRate: totalAttachments > 0 ? Math.round((processedAttachments / totalAttachments) * 100) : 0
    };
    
    res.json({
      status: 'success',
      data: summary
    });
    
  } catch (error) {
    console.error('❌ Error fetching email summary:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch email summary'
    });
  }
});

module.exports = router;