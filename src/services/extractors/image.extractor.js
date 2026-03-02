const { extractTextFromPath } = require('../gemini-ocr.service');
const prisma = require('../../utils/prisma');

const fs = require('fs');

/**
 * Image Extractor
 * ดึงข้อความจากรูปภาพโดยใช้ Gemini OCR Service
 * รับเฉพาะรูปภาพ (jpg, png, bmp, tiff, gif)
 */
module.exports = async (filePath, attachmentId = null) => {
  try {
    if (!fs.existsSync(filePath)) return '';

    // Extract text using Gemini OCR service
    const result = await extractTextFromPath(filePath);
    
    // Update OCR status if attachmentId is provided
    if (attachmentId && result) {
      try {
        await prisma.attachment.update({
          where: { id: attachmentId },
          data: { 
            ocrStatus: 'COMPLETED',
            extractedText: result
          }
        });
      } catch (dbErr) {
        console.error('❌ Failed to update image OCR status:', dbErr.message);
      }
    }
    
    return result || '';
  } catch (err) {
    console.error('❌ Image extraction failed:', err.message);
    
    // Update status to FAILED if attachmentId is provided
    if (attachmentId) {
      try {
        await prisma.attachment.update({
          where: { id: attachmentId },
          data: { ocrStatus: 'FAILED' }
        });
      } catch (dbErr) {
        console.error('❌ Failed to update image OCR error status:', dbErr.message);
      }
    }
    
    return '';
  }
};