const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');
const ImagePreprocessor = require('./image-preprocessor');
const tempPathManager = require('../../config/temp-paths');

const preprocessor = new ImagePreprocessor();

const runOCR = async (imageInput) => {
  try {
    let processedInput = imageInput;
    let preprocessedFiles = [];
    
    // 1. Preprocessing แบบหลายวิธีสำหรับภาพ
    if (typeof imageInput === 'string' && fs.existsSync(imageInput)) {
      console.log('🔧 Multi-method preprocessing image before OCR...');
      const multiResults = await preprocessor.preprocessImageMultiple(imageInput);
      
      // เก็บรายการไฟล์ที่สร้างขึ้นเพื่อลบ// ปิด auto cleanup ชั่วคราวเพื่อป้องกัน race condition
      // preprocessor.cleanup(); // ❌ ปิดไว้ก่อน
      preprocessedFiles = Object.values(multiResults);
      
      // ลอง OCR กับทุก method และเลือกที่ดีที่สุด
      const ocrResults = [];
      
      for (const [method, imagePath] of Object.entries(multiResults)) {
        try {
          console.log(`🔍 Trying OCR with ${method}...`);
          console.log(`📁 Image Path: ${imagePath}`);
          console.log(`📁 File exists: ${fs.existsSync(imagePath)}`);
          
          const text = await performOCR(imagePath);
          console.log(`📊 ${method} result: ${text ? text.length : 0} characters`);
          if (text && text.trim().length > 5) { 
            ocrResults.push({
              method,
              text: text.trim(),
              length: text.length
            });
          }
        } catch (err) {
          console.warn(`⚠️ ${method} failed: ${err.message}`);
        }
      }
      
      console.log(`📋 All OCR results: ${ocrResults.length} methods succeeded`);
      ocrResults.forEach(result => {
        console.log(`  - ${result.method}: ${result.length} chars`);
      });
      
      // เลือกผลลัพธ์ที่ดีที่สุด (ยาวที่สุด)
      if (ocrResults.length > 0) {
        const best = ocrResults.reduce((prev, current) => 
          current.length > prev.length ? current : prev
        );
        console.log(`🏆 Best result: ${best.method} (${best.length} chars)`);
        
        // ลบไฟล์ preprocessed หลังใช้งานเสร็จ
        cleanupPreprocessedFiles(preprocessedFiles);
        
        return best.text; // ไม่ต้อง cleanText อีกแล้ว!
      } else {
        console.log('❌ All OCR methods failed, trying original image...');
        
        // Fallback: ลองกับภาพต้นฉบับโดยตรง
        try {
          console.log('🔍 Trying OCR with original image...');
          const originalText = await performOCR(imageInput);
          console.log(`📊 Original image result: ${originalText ? originalText.length : 0} characters`);
          
          // ลบไฟล์ preprocessed หลังใช้งานเสร็จ
          cleanupPreprocessedFiles(preprocessedFiles);
          
          if (originalText && originalText.trim().length > 5) {
            console.log('✅ Original image OCR succeeded');
            return cleanText(originalText);
          }
        } catch (originalErr) {
          console.warn(`⚠️ Original image OCR failed: ${originalErr.message}`);
        }
      }
      
    } else if (Buffer.isBuffer(imageInput)) {
      console.log('🔧 Preprocessing image buffer before OCR...');
      processedInput = await preprocessor.preprocessBuffer(imageInput);
    }

    // 2. Final fallback: ใช้วิธีเดิม
    const result = await performOCR(processedInput);
    
    // ลบไฟล์ preprocessed หลังใช้งานเสร็จ (กรณี fallback)
    if (preprocessedFiles.length > 0) {
      cleanupPreprocessedFiles(preprocessedFiles);
    }
    
    return cleanText(result); // ✅ performOCR ส่งค่ากลับเป็น string ถูกต้อง

  } catch (err) {
    console.error(`❌ OCR Error: ${err.message}`);
    return '';
  }
};

/**
 * ลบไฟล์ preprocessed ที่สร้างขึ้น (ปลอดภัยจาก file locking)
 */
function cleanupPreprocessedFiles(filePaths) {
  try {
    filePaths.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`🧹 Deleted preprocessed file: ${path.basename(filePath)}`);
        } catch (unlinkErr) {
          // ถ้าไฟล์ถูก lock ให้ข้ามไปก่อน (Windows file locking)
          if (unlinkErr.code === 'EBUSY' || unlinkErr.code === 'EACCES') {
            console.warn(`⚠️ File busy, skipping: ${path.basename(filePath)}`);
          } else {
            console.warn(`⚠️ Cleanup warning for ${path.basename(filePath)}: ${unlinkErr.message}`);
          }
        }
      }
    });
  } catch (error) {
    console.warn('⚠️ Cleanup warning:', error.message);
  }
}

/**
 * ฟังก์ชัน OCR จริง
 */
async function performOCR(imageInput) {
  try {
    // 1. สร้าง Worker
    const worker = await Tesseract.createWorker('tha+eng');

    // 2. ตั้งค่า Parameter แบบง่ายๆ สำหรับ fallback
    await worker.setParameters({
      // Page segmentation modes
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      
      // ไม่ใช้ whitelist ให้ Tesseract อ่านตัวอักษรได้ทุกตัว
      // tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzกขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮฤฦๅๆ็่้๊๋์ัํุูึ฿ใไโเแๆ็่้๊๋์ัํุูึ',
      
      // Language model
      language_model_penalty_non_freq_dict_word: '0.1',
      language_model_penalty_non_dict_word: '0.15',
      
      // Text properties
      preserve_interword_spaces: '1',
      textord_rotation: '0',
      
      // Image processing
      tessedit_do_invert: '0',
      tessedit_zero_rejection: '0',
      tessedit_zero_rejection: 'F',
      
      // Quality control
      tessedit_reject_mode: '1',
      tessedit_minimal_rejection: '0'
    });

    // 3. เริ่มอ่าน
    const { data } = await worker.recognize(imageInput);
    
    // 4. คืนทรัพยากร
    await worker.terminate();

    return data.text || '';
  } catch (err) {
    console.error(`❌ OCR processing error: ${err.message}`);
    return '';
  }
}

/**
 * ทำความสะอาดข้อความ
 */
function cleanText(text) {
  if (!text) return '';
  
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

module.exports = { runOCR };