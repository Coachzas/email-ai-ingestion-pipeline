const { runOCR } = require('../ocr/ocr.service');
const fs = require('fs');
const path = require('path');

module.exports = async (filePath) => {
  try {
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      console.warn(`Image file not found: ${filePath}`);
      return '';
    }

    // Run OCR on image
    return await runOCR(filePath);
  } catch (err) {
    console.error(`Image OCR error for ${path.basename(filePath)}: ${err.message}`);
    return '';
  }
};
