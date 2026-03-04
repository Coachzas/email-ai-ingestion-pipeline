const extractors = require('./extractors');
const GeminiOcrService = require('./gemini-ocr.service');
const prisma = require('../utils/prisma');

/**
 * ทำความสะอาดข้อความสำหรับ database
 */
function sanitizeText(text) {
  if (!text) return '';
  return text
    .replace(/\x00/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * PURE FUNCTION: ดึงข้อความจากไฟล์โดยไม่มี side effects
 * รับแค่ filePath และคืนข้อความเท่านั้น
 */
async function extractTextFromPath(filePath, attachmentId = null) {
  const fs = require('fs');
  const path = require('path');
  if (!fs.existsSync(filePath)) return '';
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
    case '.png':
    case '.bmp':
    case '.tiff':
    case '.gif':
      try {
        const geminiService = new GeminiOcrService();
        const ocrResult = await geminiService.extractTextFromPath(filePath);
        return sanitizeText(ocrResult || '');
      } catch (ocrErr) {
        return '';
      }
    case '.pdf':
      try {
        const pdfResult = await extractors.pdf(filePath, attachmentId);
        return sanitizeText(pdfResult || '');
      } catch (pdfErr) {
        return '';
      }
    case '.csv':
      try {
        const csvResult = await extractors.csv(filePath);
        return sanitizeText(csvResult || '');
      } catch (csvErr) {
        return '';
      }
    case '.docx':
      try {
        const docxResult = await extractors.docx(filePath);
        return sanitizeText(docxResult || '');
      } catch (docxErr) {
        return '';
      }
    case '.xlsx':
      try {
        const xlsxResult = await extractors.xlsx(filePath);
        return sanitizeText(xlsxResult || '');
      } catch (xlsxErr) {
        return '';
      }
    case '.pptx':
      try {
        const pptxResult = await extractors.pptx(filePath);
        return sanitizeText(pptxResult || '');
      } catch (pptxErr) {
        return '';
      }
    default:
      return '';
  }
}

/**
 * Extract text from file based on type
 */
async function extractText(file, attachmentId = null) {
  const { filePath, fileType } = file;
  try {
    if (fileType.startsWith('image/')) {
      const geminiService = new GeminiOcrService();
      return await geminiService.extractTextFromPath(filePath);
    }
    if (fileType === 'application/pdf') {
      return await extractors.pdf(filePath, attachmentId);
    }
    if (fileType === 'text/csv') {
      return await extractors.csv(filePath);
    }
    if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await extractors.docx(filePath);
    }
    if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      return await extractors.xlsx(filePath);
    }
    if (fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      return await extractors.pptx(filePath);
    }
    return '';
  } catch (error) {
    return '';
  }
}

/**
 * Process OCR for new emails (attachments that haven't been processed yet)
 */
async function processAttachmentsForNewEmails() {
  try {
    const prisma = require('../utils/prisma');
    
    // ดึง attachments ที่ยังไม่ได้ประมวลผล OCR
    const attachments = await prisma.attachment.findMany({
      where: {
        OR: [
          { ocrStatus: null },
          { ocrStatus: { not: 'COMPLETED' } }
        ]
      },
      include: {
        email: {
          select: {
            id: true,
            subject: true,
            receivedAt: true
          }
        }
      }
    });

    console.log(`🔍 Found ${attachments.length} attachments to process for OCR`);

    if (attachments.length === 0) {
      return {
        success: true,
        processed: 0,
        errors: 0,
        message: 'No attachments to process'
      };
    }

    let processed = 0;
    let errors = 0;

    for (const attachment of attachments) {
      try {
        const fs = require('fs');
        if (!fs.existsSync(attachment.filePath)) {
          console.log(`⚠️ File not found: ${attachment.filePath}`);
          await prisma.attachment.update({
            where: { id: attachment.id },
            data: { ocrStatus: 'FAILED' }
          });
          errors++;
          continue;
        }

        // อัปเดตสถานะเป็นกำลังประมวลผล
        await prisma.attachment.update({
          where: { id: attachment.id },
          data: { ocrStatus: 'PROCESSING' }
        });

        const extractedText = await extractTextFromPath(attachment.filePath, attachment.id);
        
        // ถ้า extractedText ว่าง ให้ถือว่าเสร็จแต่ไม่มีข้อความ
        await prisma.attachment.update({
          where: { id: attachment.id },
          data: {
            extractedText: extractedText || null,
            ocrStatus: 'COMPLETED'
          }
        });

        console.log(`✅ OCR completed for ${attachment.fileName} (Email: ${attachment.email.subject})`);
        processed++;

        // Update progress tracking
        if (global.batchProgressUpdate) {
          global.batchProgressUpdate({
            processedAttachments: processed,
            totalAttachments: attachments.length
          });
        }

      } catch (error) {
        console.error(`❌ OCR failed for ${attachment.fileName}:`, error.message);
        await prisma.attachment.update({
          where: { id: attachment.id },
          data: {
            ocrStatus: 'FAILED'
          }
        });
        errors++;
      }
    }

    return {
      success: true,
      processed,
      errors,
      message: `Processed ${processed} attachments, ${errors} errors`
    };

  } catch (error) {
    console.error('❌ processAttachmentsForNewEmails failed:', error);
    return {
      success: false,
      processed: 0,
      errors: 0,
      message: error.message
    };
  }
}

module.exports = { 
  extractTextFromPath, 
  sanitizeText,
  processAttachmentsForNewEmails
};