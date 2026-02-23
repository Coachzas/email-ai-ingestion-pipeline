const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');

router.post('/process', async (req, res) => {
  try {
    console.log('🔍 Starting OCR processing with progress tracking...');
    
    const { limit = 10 } = req.body || {};
    
    const { startOcrWithProgress } = require('../controllers/ocr-progress.controller');
    
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