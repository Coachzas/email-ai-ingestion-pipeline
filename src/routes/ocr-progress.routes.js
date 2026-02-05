const express = require('express');
const router = express.Router();
const { getOcrProgress, startOcrWithProgress } = require('../controllers/ocr-progress.controller');

// SSE endpoint for real-time progress updates
router.get('/progress', getOcrProgress);

// Start OCR with progress tracking
router.post('/start', startOcrWithProgress);

module.exports = router;
