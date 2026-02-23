const { runOCR } = require('../ocr/ocr.service');
const fs = require('fs');

module.exports = async (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return '';

    return await runOCR(filePath);
  } catch (err) {
    return '';
  }
};