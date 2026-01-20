const express = require('express');
const router = express.Router();
const { runOCR } = require('../controllers/ocr.controller');

router.post('/attachments', runOCR);

module.exports = router;