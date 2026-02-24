const { extractTextFromPath } = require('../gemini-ocr.service');
const fs = require('fs');

module.exports = async (filePath, attachmentId = null) => {
  try {
    if (!fs.existsSync(filePath)) return '';

    return await extractTextFromPath(filePath);
  } catch (err) {
    return '';
  }
};