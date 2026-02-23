const fs = require('fs');
const prisma = require('../../utils/prisma');
const pdfParse = require('pdf-parse');
const { fromPath } = require('pdf2pic');
const { runOCR } = require('../ocr/ocr.service');
const tempPathManager = require('../../config/temp-paths');

const updateAttachmentStatus = async (attachmentId, status) => {
  if (!attachmentId) return;
  try {
    await prisma.attachment.update({
      where: { id: attachmentId },
      data: { ocrStatus: status }
    });
  } catch (dbErr) {
    // เงียบไว้
  }
};

const pdfExtractor = async (filePath, attachmentId = null) => {
  if (attachmentId) await updateAttachmentStatus(attachmentId, 'PROCESSING');

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
          if (attachmentId) await updateAttachmentStatus(attachmentId, 'COMPLETED');
          return cleanText;
        }
      }
    } catch (parseErr) {
      // ข้ามไป OCR
    }

    // --- Method 2: OCR ---
    const pdfOptions = {
      savePath: tempPathManager.getPdfPath(),
      format: "png",
      width: 3000,
      height: 4000,
      quality: 100,
      density: 300
    };

    const convert = fromPath(filePath, pdfOptions);
    const convertWithCatch = async (pageNum) => {
      return await Promise.race([
        convert(pageNum, { responseType: "buffer" }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 45000))
      ]);
    };

    const stats = fs.statSync(filePath);
    const maxPages = stats.size > 2 * 1024 * 1024 ? 1 : 
                    stats.size > 500 * 1024 ? 3 : 5;

    let allText = '';
    
    for (let page = 1; page <= maxPages; page++) {
      try {
        const resolve = await convertWithCatch(page);
        if (resolve && resolve.buffer) {
          const ocrText = await runOCR(resolve.buffer);
          if (ocrText && ocrText.trim().length > 20) {
            allText += ocrText + '\n\n';
          }
        }
      } catch (pageErr) {
        if (pageErr.message.includes('FormatError') || pageErr.message.includes('flate stream')) {
          break;
        }
      }
    }

    const finalText = allText.trim();
    if (attachmentId) await updateAttachmentStatus(attachmentId, 'COMPLETED');
    return finalText;

  } catch (err) {
    if (attachmentId) await updateAttachmentStatus(attachmentId, 'FAILED');
    return '';
  }
};

module.exports = pdfExtractor;