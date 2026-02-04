const csvExtractor = require('./csv.extractor');
const docxExtractor = require('./docx.extractor');
const pdfExtractor = require('./pdf.extractor');
const pptxExtractor = require('./pptx.extractor');
const xlsxExtractor = require('./xlsx.extractor');
const imageExtractor = require('./image.extractor');

module.exports = {
  csv: csvExtractor,
  docx: docxExtractor,
  pdf: pdfExtractor,
  pptx: pptxExtractor,
  xlsx: xlsxExtractor,
  image: imageExtractor,
};
