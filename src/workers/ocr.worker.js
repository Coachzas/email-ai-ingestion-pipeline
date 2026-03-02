const { PrismaClient } = require('@prisma/client');
const extractors = require('../services/extractors');
const { sanitizeText } = require('../services/attachment-ocr.service');

const prisma = new PrismaClient();

module.exports = async ({ filePath, attachmentId }) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }
    
    const ext = path.extname(filePath).toLowerCase();
    let text = '';
    
    // Handle different file types directly
    if (['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.gif', '.webp'].includes(ext)) {
      text = await extractors.image(filePath, attachmentId);
    } else if (ext === '.pdf') {
      text = await extractors.pdf(filePath, attachmentId);
    } else {
      text = await extractors[ext.replace('.', '')](filePath, attachmentId);
    }
    
    const sanitizedText = sanitizeText(text);
    
    // Update both extractedText and ocrStatus to maintain consistency
    await prisma.attachment.update({
      where: { id: attachmentId },
      data: { 
        extractedText: sanitizedText || null,
        ocrStatus: 'COMPLETED'
      }
    });
    
    return {
      success: true,
      attachmentId,
      text: sanitizedText,
      filePath
    };
    
  } catch (error) {
    // Update status to FAILED on failure
    try {
      await prisma.attachment.update({
        where: { id: attachmentId },
        data: { 
          ocrStatus: 'FAILED'
        }
      });
    } catch (updateErr) {
      console.error('❌ Failed to update error status:', updateErr.message);
    }
    
    return {
      success: false,
      attachmentId,
      error: error.message,
      filePath
    };
  }
};
