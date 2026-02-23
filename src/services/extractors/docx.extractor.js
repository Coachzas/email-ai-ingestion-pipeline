const mammoth = require('mammoth');
const fs = require('fs');

module.exports = async (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return '';
    
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  } catch (error) {
    return '';
  }
};