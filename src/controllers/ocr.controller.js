const { processAttachmentsOCR } = require('../services/attachment-ocr.service');

async function runOCR(req, res) {
  try {
    const result = await processAttachmentsOCR(10);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}

module.exports = { runOCR };
