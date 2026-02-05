const express = require('express');
const router = express.Router();
const { runOCR } = require('../controllers/ocr.controller');
const { processAttachmentsOCR } = require('../services/attachment-ocr.service');
const prisma = require('../utils/prisma');

router.post('/attachments', runOCR);

router.post('/process', async (req, res) => {
  res.json({ status: 'started' });

  processAttachmentsOCR(10)
    .then(() => console.log('✅ OCR done'))
    .catch(console.error);
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