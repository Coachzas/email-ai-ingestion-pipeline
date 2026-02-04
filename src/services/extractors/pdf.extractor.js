const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

module.exports = async (filePath) => {
  try {
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      console.warn(`PDF file not found: ${filePath}`);
      return '';
    }

    // Extract text from PDF
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text || '';
  } catch (err) {
    console.error(`PDF extraction error for ${path.basename(filePath)}: ${err.message}`);
    return '';
  }
};
