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
  timeout: 30000, // 30 seconds
  minConfidence: 0, // 0-100
};

/**
 * Run OCR on image file
 * @param {string} filePath - path ของไฟล์
 * @returns {Promise<string>} - extracted text
 */
async function runOCR(filePath) {
  try {
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Convert to absolute path
    const absolutePath = path.resolve(filePath);
    
    // Validate tessdata directory
    if (!fs.existsSync(TESSDATA_PATH)) {
      throw new Error(`tessdata directory not found at ${TESSDATA_PATH}`);
    }

    console.log(`📖 OCR reading: ${path.basename(absolutePath)}`);

    // Read file as buffer (more reliable than file path)
    const imageBuffer = fs.readFileSync(absolutePath);

    const { data } = await Tesseract.recognize(imageBuffer, OCR_CONFIG.languages, {
      langPath: OCR_CONFIG.tessdataPath,
      gzip: false,
      logger: (m) => {
        // Only log recognizing progress
        if (m.status === 'recognizing text') {
          const percent = Math.round(m.progress * 100);
          if (percent % 25 === 0) {
            console.log(`  └─ OCR progress: ${percent}%`);
          }
        }
      },
    });

    return data.text || '';
  } catch (err) {
    console.error(`❌ OCR error for ${filePath}:`, err.message);
    throw new Error(`OCR failed: ${err.message}`);
  }
}

module.exports = {
  runOCR,
  OCR_CONFIG,
};
