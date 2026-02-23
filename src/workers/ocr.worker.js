const { PrismaClient } = require('@prisma/client');
const { extractTextFromPath } = require('../services/attachment-ocr.service');

// Worker ต้องมี Prisma Instance ของตัวเอง
const prisma = new PrismaClient();

/**
 * Worker Thread Main Function
 * รับ { filePath, attachmentId } และคืน { success, attachmentId, text, error }
 */
module.exports = async ({ filePath, attachmentId }) => {
  console.log(`🧵 Worker processing: ${filePath} (ID: ${attachmentId})`);
  
  try {
    // เรียก Pure Function เพื่อดึงข้อความ (ไม่มี side effects)
    const text = await extractTextFromPath(filePath);
    console.log(`🧵 Worker extracted ${text.length} chars from ${filePath}`);
    
    // อัปเดต Database (Side Effect แยกออกมา)
    console.log(`🧵 Worker updating database for attachment ${attachmentId}`);
    await prisma.attachment.update({
      where: { id: attachmentId },
      data: { extractedText: text }
    });
    console.log(`🧵 Worker database update SUCCESS for attachment ${attachmentId}`);
    
    return {
      success: true,
      attachmentId,
      text,
      filePath
    };
    
  } catch (error) {
    console.error(`🧵 Worker error for ${filePath}:`, error.message);
    
    return {
      success: false,
      attachmentId,
      error: error.message,
      filePath
    };
  }
};
