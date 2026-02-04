const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');

const TESSDATA_PATH = path.join(process.cwd(), 'tessdata');

/**
 * OCR Configuration - ควบคุม behavior ของ OCR
 */
const OCR_CONFIG = {
  languages: 'tha+eng',
  tessdataPath: TESSDATA_PATH,
  timeout: 60000, // 60 seconds
  minConfidence: 0, // 0-100
  // ป้องกันการดาวน์โหลด trained data ซ้ำซ้อน
  cachePath: path.join(process.cwd(), '.tesseract-cache'),
  disableAutoDownload: true,
};

/**
 * Validate tessdata setup
 */
function validateTessdata() {
  if (!fs.existsSync(TESSDATA_PATH)) {
    throw new Error(`tessdata directory not found at ${TESSDATA_PATH}`);
  }

  const engData = path.join(TESSDATA_PATH, 'eng.traineddata');
  const thaData = path.join(TESSDATA_PATH, 'tha.traineddata');

  if (!fs.existsSync(engData)) {
    console.warn(`⚠️  English trained data not found: ${engData}`);
  }

  if (!fs.existsSync(thaData)) {
    console.warn(`⚠️  Thai trained data not found: ${thaData}`);
  }

  console.log(`✅ tessdata directory found at: ${TESSDATA_PATH}`);
  return true;
}

/**
 * Run OCR on image file
 * @param {string} filePath - path ของไฟล์
 * @returns {Promise<string>} - extracted text
 */
async function runOCR(filePath) {
  try {
    // Validate tessdata setup
    validateTessdata();

    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Convert to absolute path
    const absolutePath = path.resolve(filePath);
    
    console.log(`📖 OCR reading: ${path.basename(absolutePath)}`);

    // Read file as buffer (more reliable than file path)
    const imageBuffer = fs.readFileSync(absolutePath);

    // Create worker with proper configuration
    const worker = await Tesseract.createWorker(OCR_CONFIG.languages, 1, {
      logger: (m) => {
        // Only log recognizing progress
        if (m.status === 'recognizing text') {
          const percent = Math.round(m.progress * 100);
          if (percent % 25 === 0) {
            console.log(`  └─ OCR progress: ${percent}%`);
          }
        }
      },
      // ใช้ local tessdata เท่านั้น ไม่ดาวน์โหลดใหม่
      langPath: OCR_CONFIG.tessdataPath,
      gzip: false,
      cachePath: OCR_CONFIG.cachePath,
    });

    // Set tessdata path
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzกขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮฤฦๆ๏๐๑๒๓๔๕๖๗๘๙๚๛.,!?()[]{}:;\'"-/\\@#$%^&*+=<>\n\r\t ',
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
    });

    // Set tessdata path
    if (fs.existsSync(TESSDATA_PATH)) {
      await worker.setParameters({
        tessdata_prefix: TESSDATA_PATH,
      });
    }

    // Recognize text
    const { data } = await worker.recognize(imageBuffer);
    
    // Cleanup worker
    await worker.terminate();

    const extractedText = data.text || '';
    console.log(`✅ OCR completed: ${extractedText.length} characters extracted`);
    
    return extractedText;
  } catch (err) {
    console.error(`❌ OCR error for ${filePath}:`, err.message);
    throw new Error(`OCR failed: ${err.message}`);
  }
}

module.exports = {
  runOCR,
  OCR_CONFIG,
  validateTessdata,
};
