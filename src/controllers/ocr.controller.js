const { processAttachmentsOCR } = require('../services/attachment-ocr.service');

async function runOCR(req, res) {
  try {
    console.log('📋 Starting OCR processing...');
    const result = await processAttachmentsOCR(10);
    console.log('✅ OCR processing completed:', result);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('❌ OCR Error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}

module.exports = { runOCR };
