const { PrismaClient } = require('@prisma/client');
const { extractTextFromPath } = require('../services/attachment-ocr.service');

const prisma = new PrismaClient();

module.exports = async ({ filePath, attachmentId }) => {
  try {
    const text = await extractTextFromPath(filePath);
    
    await prisma.attachment.update({
      where: { id: attachmentId },
      data: { extractedText: text }
    });
    
    return {
      success: true,
      attachmentId,
      text,
      filePath
    };
    
  } catch (error) {
    return {
      success: false,
      attachmentId,
      error: error.message,
      filePath
    };
  }
};
