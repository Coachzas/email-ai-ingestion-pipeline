const mammoth = require('mammoth');

module.exports = async (filePath) => {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || '';
};
