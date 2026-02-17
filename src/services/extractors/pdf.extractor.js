const fs = require('fs');
const path = require('path');
const prisma = require('../../utils/prisma');

// การโหลดไลบรารี pdf-parse
let pdfParse;
let pdfParseLoaded = false;

try {
  const pdfParseLib = require('pdf-parse');
  if (typeof pdfParseLib === 'function') {
    pdfParse = pdfParseLib;
    pdfParseLoaded = true;
    console.log('✅ pdf-parse loaded');
  } else if (pdfParseLib.default && typeof pdfParseLib.default === 'function') {
    pdfParse = pdfParseLib.default;
    pdfParseLoaded = true;
  }
} catch (err) {
  console.error('❌ Failed to load pdf-parse:', err.message);
}

const { runOCR } = require('../ocr/ocr.service');
const { fromPath } = require('pdf2pic');

/**
 * ฟังก์ชันช่วยอัปเดตสถานะในฐานข้อมูล
 */
const updateAttachmentStatus = async (attachmentId, status) => {
  if (!attachmentId) return;
  try {
    await prisma.attachment.update({
      where: { id: attachmentId },
      data: { ocrStatus: status }
    });
    console.log(`  📊 Status -> ${status}`);
  } catch (dbErr) {
    console.warn(`  ⚠️ DB Update Failed: ${dbErr.message}`);
  }
};

/**
 * PDF Extractor: ดึงข้อความจากไฟล์ต้นฉบับโดยตรง
 */
const pdfExtractor = async (filePath, attachmentId = null) => {
  if (attachmentId) await updateAttachmentStatus(attachmentId, 'PROCESSING');

  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`❌ File not found: ${filePath}`);
      return '';
    }

    console.log(`\n📄 Processing Original File: ${path.basename(filePath)}`);
    const dataBuffer = fs.readFileSync(filePath);

    // --- Method 1: ดึง Digital Text จากไฟล์ต้นฉบับโดยตรง ---
    if (pdfParseLoaded) {
      try {
        const data = await pdfParse(dataBuffer);
        if (data && data.text) {
          const cleanText = data.text.trim();
          if (cleanText.length > 150) {
            console.log('  ✅ Method 1 Success (Digital Text Found)');
            if (attachmentId) await updateAttachmentStatus(attachmentId, 'COMPLETED');
            return cleanText;
          }
        }
      } catch (parseErr) {
        // ถ้าเจอ Error เรื่องการถอดรหัส (เช่น flate stream) ให้ข้ามไปทำ OCR ทันที
        console.warn(`  ⚠️ Digital extraction failed, moving to OCR: ${parseErr.message}`);
      }
    }

    // --- Method 2: OCR (กรณีดึงข้อความดิจิทัลไม่ได้) ---
    console.log('  ⚠️ No digital text, starting OCR...');
    const tempFilename = path.basename(filePath, '.pdf');
    const pdfOptions = {
      savePath: "./temp",
      format: "png",
      width: 2500
    };

    if (!fs.existsSync("./temp")) fs.mkdirSync("./temp", { recursive: true });

    const convert = fromPath(filePath, pdfOptions);

    // ฟังก์ชันครอบการแปลงไฟล์เพื่อดักจับ Error และ Timeout
    const convertWithCatch = async (pageNum) => {
      return await Promise.race([
        convert(pageNum, { responseType: "buffer" }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Conversion timeout')), 30000))
      ]);
    };

    const stats = fs.statSync(filePath);
    const maxPages = stats.size > 1024 * 1024 ? 1 : 3; // ไฟล์ใหญ่ทำหน้าเดียว

    for (let page = 1; page <= maxPages; page++) {
      try {
        const resolve = await convertWithCatch(page);
        if (resolve && resolve.buffer) {
          const ocrText = await runOCR(resolve.buffer);
          if (ocrText && ocrText.trim().length > 50) {
            console.log(`  🎉 OCR Success on page ${page}`);
            if (attachmentId) await updateAttachmentStatus(attachmentId, 'COMPLETED');
            return ocrText.trim();
          }
        }
      } catch (pageErr) {
        console.error(`  ❌ Page ${page} Error: ${pageErr.message}`);
        // ถ้าเจอ Bad encoding ในหน้าใดก็ตาม ให้หยุดทำหน้านั้นๆ เพื่อป้องกัน Crash
        if (pageErr.message.includes('FormatError') || pageErr.message.includes('flate stream')) break;
      }
    }

    if (attachmentId) await updateAttachmentStatus(attachmentId, 'COMPLETED');
    return '';

  } catch (err) {
    console.error(`  ❌ Global PDF Error: ${err.message}`);
    if (attachmentId) await updateAttachmentStatus(attachmentId, 'FAILED');
    return '';
  }
};

module.exports = pdfExtractor;