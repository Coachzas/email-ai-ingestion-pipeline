const { extractTextFromPath } = require('../gemini-ocr.service');

const fs = require('fs');

/**
 * Image Extractor
 * ดึงข้อความจากรูปภาพโดยใช้ Gemini OCR Service
 * รับเฉพาะรูปภาพ (jpg, png, bmp, tiff, gif)
 * 
 * หมายเหตุ: ไม่บันทึกฐานข้อมูลที่นี่ - ให้ attachment-ocr.service.js จัดการ
 * เพื่อป้องกันการบันทึกซ้ำซ้อนและ race condition
 */
module.exports = async (filePath, attachmentId = null) => {
  try {
    if (!fs.existsSync(filePath)) return '';

    // Extract text using Gemini OCR service
    const result = await extractTextFromPath(filePath, { attachmentId });
    
    // ไม่บันทึกฐานข้อมูลที่นี่
    // ให้ attachment-ocr.service.js จัดการการบันทึกที่จุดเดียว
    console.log(`🔍 Image OCR extracted for ${require('path').basename(filePath)}: ${result?.length || 0} chars`);
    
    return result || '';
  } catch (err) {
    console.error('❌ Image extraction failed:', err.message);
    
    // ไม่บันทึกสถานะ FAILED ที่นี่
    // ให้ attachment-ocr.service.js จัดการ
    
    return '';
  }
};