const extractors = require('./extractors');
const { runOCR } = require('./ocr/ocr.service');
const prisma = require('../utils/prisma');

/**
 * ทำความสะอาดข้อความสำหรับ database
 */
function sanitizeText(text) {
  if (!text) return '';
  
  return text
    // ลบ null bytes และ control characters
    .replace(/\x00/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // แปลง newline ให้เป็นมาตรฐาน
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // ลบช่องว่างซ้ำ
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * PURE FUNCTION: ดึงข้อความจากไฟล์โดยไม่มี side effects
 * รับแค่ filePath และคืนข้อความเท่านั้น
 */
async function extractTextFromPath(filePath) {
  const fs = require('fs');
  const path = require('path');
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const ext = path.extname(filePath).toLowerCase();
  
  switch (ext) {
    case '.jpg':
    case '.jpeg':
    case '.png':
    case '.bmp':
    case '.tiff':
    case '.gif':
      try {
        if (!fs.existsSync(filePath)) return '';
        const ocrResult = await runOCR(filePath);
        return sanitizeText(ocrResult || '');
      } catch (ocrErr) {
        return '';
      }
      
    case '.pdf':
      const pdfResult = await extractors.pdf(filePath);
      return sanitizeText(pdfResult || '');
      
    case '.csv':
      try {
        if (!fs.existsSync(filePath)) return '';
        const csvResult = await extractors.csv(filePath);
        return sanitizeText(csvResult || '');
      } catch (csvErr) {
        return '';
      }
      
    case '.xlsx':
      try {
        if (!fs.existsSync(filePath)) return '';
        const xlsxResult = await extractors.xlsx(filePath);
        return sanitizeText(xlsxResult || '');
      } catch (xlsxErr) {
        return '';
      }
      
    case '.docx':
      try {
        const docxResult = await extractors.docx(filePath);
        return sanitizeText(docxResult || '');
      } catch (docxErr) {
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
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

/**
 * Extract text from file based on type
 */
async function extractText(file, attachmentId = null) {
  const { filePath, fileType } = file;

  try {
    if (fileType.startsWith('image/')) {
      return await runOCR(filePath);
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
 * Process attachments that don't have extractedText yet
 */
async function processAttachmentsOCR(limit = 30) {
  const attachments = await prisma.attachment.findMany({
    where: {
      OR: [
        { extractedText: null },
        { extractedText: '' }
      ]
    },
    take: typeof limit === 'number' ? limit : undefined,
  });

  let processed = 0;
  let errors = 0;
  let skipped = 0;
  const results = [];

  for (const att of attachments) {
    try {
      const fs = require('fs');
      if (!fs.existsSync(att.filePath)) {
        results.push({ fileName: att.fileName, status: 'missing' });
        errors++;
        continue;
      }

      const stats = fs.statSync(att.filePath);
      if (stats.size === 0) {
        results.push({ fileName: att.fileName, status: 'skipped' });
        skipped++;
        continue;
      }

      const file = { filePath: att.filePath, fileType: att.fileType, originalName: att.fileName };
      const extractPromise = extractText(file, att.id);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 30000)
      );

      let text = '';
      try {
        text = await Promise.race([extractPromise, timeoutPromise]);
      } catch (timeoutErr) {
        text = '';
        errors++;
      }

      const hasText = text && text.trim().length > 0;
      const sanitizedText = sanitizeText(text);
      
      await prisma.attachment.update({
        where: { id: att.id },
        data: { 
          extractedText: hasText ? sanitizedText : undefined,
          ocrStatus: 'COMPLETED'
        }
      });
      
      results.push({ fileName: att.fileName, status: hasText ? 'success' : 'no_text' });
      
      if (hasText) processed++; else skipped++;
    } catch (err) {
      results.push({ fileName: att.fileName, status: 'error' });
      errors++;
    }
  }

  return { total: attachments.length, processed, errors, skipped, results };
}

module.exports = { extractTextFromPath, processAttachmentsOCR };