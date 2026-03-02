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

module.exports = { extractTextFromPath, sanitizeText };