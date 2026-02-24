const express = require('express');
const { testGeminiConnection, testGeminiOcr } = require('../controllers/gemini.controller');

const router = express.Router();

// ทดสอบการเชื่อมต่อกับ Gemini API
router.post('/test-connection', testGeminiConnection);

// ทดสอบ OCR กับไฟล์
router.post('/test-ocr', testGeminiOcr);

module.exports = router;
