const fs = require('fs');
const prisma = require('../../utils/prisma');
const pdfParse = require('pdf-parse');
const { extractTextFromBuffer } = require('../gemini-ocr.service');

// Comment out database update to avoid conflicts with attachment-ocr.service.js
// Let attachment-ocr.service.js handle all database updates
/*
const updateAttachmentStatus = async (attachmentId, status) => {
  if (!attachmentId) {
    console.log(`⚠️ No attachmentId provided for status update: ${status}`);
    return;
  }
  try {
    console.log(`📊 Updating attachment ${attachmentId} status to: ${status}`);
    await prisma.attachment.update({
      where: { id: attachmentId },
      data: { ocrStatus: status }
    });
    console.log(`✅ Successfully updated attachment ${attachmentId} status to: ${status}`);
  } catch (dbErr) {
    console.error(`❌ Failed to update attachment ${attachmentId} status:`, dbErr.message);
  }
};
*/

const pdfExtractor = async (filePath, attachmentId = null) => {
  // Remove status update to avoid conflicts
  // if (attachmentId) await updateAttachmentStatus(attachmentId, 'PROCESSING');

  try {
    if (!fs.existsSync(filePath)) return '';

    const dataBuffer = fs.readFileSync(filePath);

    // --- Method 1: Digital Text ---
    try {
      const data = await pdfParse(dataBuffer);
      if (data && data.text) {
        let cleanText = data.text.trim()
          .replace(/\x00/g, '')
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        
        if (cleanText.length > 150) {
          // Remove status update to avoid conflicts
          // if (attachmentId) await updateAttachmentStatus(attachmentId, 'COMPLETED');
          return cleanText;
        }
      }
    } catch (parseErr) {
      // ข้ามไป OCR
    }

    // --- Method 2: Direct Gemini OCR ---
    const result = await extractTextFromBuffer(dataBuffer, 'application/pdf');
    
    // Remove status update to avoid conflicts
    // if (attachmentId) await updateAttachmentStatus(attachmentId, 'COMPLETED');
    return result;

  } catch (err) {
    // Remove status update to avoid conflicts
    // if (attachmentId) await updateAttachmentStatus(attachmentId, 'ERROR');
    return '';
  }
};

module.exports = pdfExtractor;