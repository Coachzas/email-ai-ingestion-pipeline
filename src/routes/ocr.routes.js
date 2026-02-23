const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');

router.post('/process', async (req, res) => {
  try {
    const { limit = 10 } = req.body || {};
    
    const { startOcrWithProgress } = require('../controllers/ocr-progress.controller');
    
    // เริ่มกระบวนการ OCR พร้อมระบบติดตาม Progress
    startOcrWithProgress(req, res, limit);
    
  } catch (error) {
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
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch OCR summary',
      error: error.message
    });
  }
});

module.exports = router;