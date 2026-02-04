const express = require('express');
const router = express.Router();
const { runOCR } = require('../controllers/ocr.controller');
const { processAttachmentsOCR } = require('../services/attachment-ocr.service');


router.post('/attachments', runOCR);
router.post('/process', async (req, res) => {
  res.json({ status: 'started' });

  processAttachmentsOCR(10)
    .then(() => console.log('✅ OCR done'))
    .catch(console.error);
});


module.exports = router;